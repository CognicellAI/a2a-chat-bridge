import { App, LogLevel, type RespondFn, type SlashCommand } from "@slack/bolt";
import type { SlackChannelPolicy } from "../config.js";
import type { A2AConnector } from "../core/a2a-connector.js";
import type { ContactRegistry } from "../core/contacts.js";
import type { RuntimeConfig } from "../core/runtime-config.js";
import type { ReplySink, StateStore } from "../core/ports.js";
import type { Contact, Session, Surface, TaskRecord } from "../domain.js";
import { surfaceKey } from "../domain.js";
import { labelAgentReply, workspaceIntroduction } from "../discord/adapter.js";

interface SlackEvent {
  channel: string;
  ts: string;
  thread_ts?: string;
  text?: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
  channel_type?: string;
}

interface SlackMessage {
  readonly channel: string;
  readonly threadTs?: string;
  readonly user: string;
  readonly text: string;
  readonly surface: Surface;
  readonly policy?: SlackChannelPolicy;
}

type SessionResolution =
  | { kind: "existing"; session: Session }
  | { kind: "created"; session: Session };

const maxMessageLength = 4_000;

export class SlackAdapter {
  private readonly app: App;
  private readonly selectedContactBySurface = new Map<string, string>();

  public constructor(
    botToken: string,
    appToken: string,
    private readonly state: StateStore,
    private readonly contacts: ContactRegistry,
    private readonly connector: A2AConnector,
    private readonly runtimeConfig: RuntimeConfig,
  ) {
    this.app = new App({
      token: botToken,
      appToken,
      socketMode: true,
      logLevel: LogLevel.INFO,
    });
  }

  async start(): Promise<void> {
    await this.syncConfiguredContacts();
    this.runtimeConfig.startPolling(async () => {
      await this.syncConfiguredContacts();
      console.info(
        `Configuration reloaded (revision ${this.runtimeConfig.snapshot().revision}).`,
      );
    });
    this.app.event("app_mention", async ({ event, client }) => {
      await this.handleMention(event as SlackEvent, client);
    });
    this.app.event("message", async ({ event, client }) => {
      const message = event as SlackEvent;
      if (message.channel_type === "im") await this.handleDm(message, client);
    });
    this.app.command("/a2a", async ({ command, ack, client, respond }) => {
      await ack();
      await this.handleNativeCommand(command, client, respond);
    });
    await this.app.start();
    console.info("Connected to Slack through Socket Mode.");
  }

  private policy(channel: string): SlackChannelPolicy | undefined {
    return this.runtimeConfig
      .snapshot()
      .config.slack?.channels.find((candidate) => candidate.id === channel);
  }

  private async handleDm(
    event: SlackEvent,
    client: App["client"],
  ): Promise<void> {
    if (!event.user || event.bot_id || event.subtype || !event.text) return;
    await this.handle(
      {
        channel: event.channel,
        user: event.user,
        text: event.text.trim(),
        surface: { platform: "slack", kind: "dm", id: event.channel },
      },
      client,
    );
  }

  private async handleMention(
    event: SlackEvent,
    client: App["client"],
  ): Promise<void> {
    if (!event.user || event.bot_id || event.subtype || !event.text) return;
    const policy = this.policy(event.channel);
    if (!policy) return;
    if (!event.thread_ts) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: "A2A conversations run in a Slack thread. Reply here in a thread, then mention @A2ABridge.",
      });
      return;
    }
    const text = event.text.replace(/<@[^>]+>/g, "").trim();
    if (!text) return;
    await this.handle(
      {
        channel: event.channel,
        threadTs: event.thread_ts,
        user: event.user,
        text,
        policy,
        surface: {
          platform: "slack",
          kind: "thread",
          id: `${event.channel}:${event.thread_ts}`,
        },
      },
      client,
    );
  }

  private async handleNativeCommand(
    command: SlashCommand,
    client: App["client"],
    respond: RespondFn,
  ): Promise<void> {
    const policy = this.policy(command.channel_id);
    if (!policy) {
      await respond({
        response_type: "ephemeral",
        text: "Use `/a2a` in a channel configured for this bridge.",
      });
      return;
    }
    const [action, ...arguments_] = command.text.trim().split(/\s+/);
    if (!action || action === "help") {
      await respond({
        response_type: "ephemeral",
        text: this.nativeCommandHelp(),
      });
      return;
    }
    if (action === "agents") {
      const contacts = await this.availableContacts(policy);
      await respond({
        response_type: "ephemeral",
        text: contacts.length
          ? contacts
              .map(
                (contact) =>
                  `• ${this.aliasFor(contact) ?? contact.id} — ${contact.name}`,
              )
              .join("\n")
          : "No A2A agents are configured for this channel.",
      });
      return;
    }
    if (action !== "start" || arguments_.length === 0) {
      await respond({
        response_type: "ephemeral",
        text: this.nativeCommandHelp(),
      });
      return;
    }

    const [possibleAgent, ...remainingRequest] = arguments_;
    const explicitlySelected = possibleAgent
      ? await this.availableContact(possibleAgent, policy)
      : undefined;
    const contact =
      explicitlySelected ??
      (await this.selectedContact(
        { platform: "slack", kind: "thread", id: command.channel_id },
        policy,
      ));
    const request = (explicitlySelected ? remainingRequest : arguments_).join(
      " ",
    );
    if (!contact) {
      await respond({
        response_type: "ephemeral",
        text: "No default A2A agent is configured. Use `/a2a agents` to see available agents.",
      });
      return;
    }
    if (!request) {
      await respond({
        response_type: "ephemeral",
        text: this.nativeCommandHelp(),
      });
      return;
    }

    const root = await client.chat.postMessage({
      channel: command.channel_id,
      text: `*A2A workspace — ${contact.name}*\nRequested by <@${command.user_id}>. Reply in this thread to collaborate.`,
    });
    if (!root.ts)
      throw new Error("Slack did not return a workspace timestamp.");
    const message: SlackMessage = {
      channel: command.channel_id,
      threadTs: root.ts,
      user: command.user_id,
      text: request,
      policy,
      surface: {
        platform: "slack",
        kind: "thread",
        id: `${command.channel_id}:${root.ts}`,
      },
    };
    this.selectedContactBySurface.set(surfaceKey(message.surface), contact.id);
    await respond({
      response_type: "ephemeral",
      text: `Started a ${contact.name} workspace thread.`,
    });
    await this.handle(message, client);
  }

  private nativeCommandHelp(): string {
    return "Commands: `/a2a start [agent] <request>` starts a workspace thread; `/a2a agents` lists agents. Use `@A2ABridge /a2a …` for controls inside an active thread.";
  }

  private async handle(
    message: SlackMessage,
    client: App["client"],
  ): Promise<void> {
    if (message.text.startsWith("/a2a")) {
      await this.handleControl(message, client);
      return;
    }
    const contact = await this.selectedContact(message.surface, message.policy);
    if (!contact) {
      await this.post(
        client,
        message,
        "No A2A agent is selected. Send `/a2a contact list`, then `/a2a contact use <agent>`.",
      );
      return;
    }
    const resolution = await this.activeOrNewSession(contact, message.surface);
    if (resolution.kind === "created" && message.surface.kind === "thread")
      await this.post(
        client,
        message,
        this.workspaceIntro(contact, resolution.session),
      );
    try {
      await this.connector.send(
        contact,
        resolution.session,
        message.text,
        this.replySink(client, message, contact),
      );
    } catch (error) {
      await this.post(
        client,
        message,
        `A2A request failed: ${(error as Error).message}`,
      );
    }
  }

  private async handleControl(
    message: SlackMessage,
    client: App["client"],
  ): Promise<void> {
    const [group, command, argument] = message.text
      .slice("/a2a".length)
      .trim()
      .split(/\s+/, 3);
    if (!group || !command) {
      await this.post(
        client,
        message,
        "Commands: `/a2a contact list|current|use <agent>`, `/a2a session new|current|list|use <session>`, `/a2a task current|list|status <task>`.",
      );
      return;
    }
    const reply = (text: string) => this.post(client, message, text);
    const mutation = () =>
      message.surface.kind === "dm" ||
      message.policy?.mutators.includes(message.user) === true;
    const requireMutation = async () => {
      if (mutation()) return true;
      await reply(
        "Only a configured Slack thread mutator can change this workspace's A2A agent or Session.",
      );
      return false;
    };
    if (group === "contact" && command === "list") {
      const contacts = await this.availableContacts(message.policy);
      await reply(
        contacts.length
          ? contacts
              .map(
                (contact) =>
                  `• ${this.aliasFor(contact) ?? contact.id} — ${contact.name}`,
              )
              .join("\n")
          : "No configured A2A agents are currently available.",
      );
      return;
    }
    if (group === "contact" && command === "current") {
      const contact = await this.selectedContact(
        message.surface,
        message.policy,
      );
      await reply(
        contact
          ? `This ${this.surfaceLabel(message.surface)} is using *${contact.name}* (${this.aliasFor(contact) ?? contact.id}).\nAgent Card: ${contact.agentCardUrl}`
          : "No A2A agent is selected. Send `/a2a contact list` then `/a2a contact use <agent>`.",
      );
      return;
    }
    if (group === "contact" && command === "use") {
      if (!(await requireMutation())) return;
      const contact = argument
        ? await this.availableContact(argument, message.policy)
        : undefined;
      if (!contact) {
        await reply("Unknown A2A agent. Send `/a2a contact list`.");
        return;
      }
      this.selectedContactBySurface.set(
        surfaceKey(message.surface),
        contact.id,
      );
      await reply(
        `Selected *${contact.name}* (${this.aliasFor(contact) ?? contact.id}) for this ${this.surfaceLabel(message.surface)}.`,
      );
      return;
    }
    const contact = await this.selectedContact(message.surface, message.policy);
    if (!contact) {
      await reply(
        `No A2A agent is selected for this ${this.surfaceLabel(message.surface)}.`,
      );
      return;
    }
    if (group === "session" && command === "new") {
      if (!(await requireMutation())) return;
      const previous = await this.state.getActiveSession(
        contact.id,
        message.surface,
      );
      const session = await this.createSession(contact, message.surface);
      await reply(
        message.surface.kind === "thread"
          ? this.workspaceIntro(contact, session)
          : previous
            ? `Archived ${previous.id} and started ${session.id} with *${contact.name}*.`
            : `Started ${session.id} with *${contact.name}*.`,
      );
      return;
    }
    if (group === "session" && command === "current") {
      const session = await this.state.getActiveSession(
        contact.id,
        message.surface,
      );
      await reply(
        session
          ? this.describeSession(session, true)
          : `No session has started with *${contact.name}*. Send a message to start one.`,
      );
      return;
    }
    if (group === "session" && command === "list") {
      const [sessions, active] = await Promise.all([
        this.state.listSessions(contact.id, message.surface),
        this.state.getActiveSession(contact.id, message.surface),
      ]);
      await reply(
        sessions.length
          ? sessions
              .map(
                (session) =>
                  `${session.id === active?.id ? "• *active*" : "•"} ${this.describeSession(session, false)}`,
              )
              .join("\n")
          : `No saved sessions for this A2A agent in this ${this.surfaceLabel(message.surface)}.`,
      );
      return;
    }
    if (group === "session" && command === "use") {
      if (!(await requireMutation())) return;
      const session = argument
        ? await this.state.getSession(argument)
        : undefined;
      if (
        !session ||
        session.contactId !== contact.id ||
        surfaceKey(session.surface) !== surfaceKey(message.surface)
      ) {
        await reply("Unknown Session. Send `/a2a session list`.");
        return;
      }
      await this.state.selectSession(contact.id, message.surface, session.id);
      await reply(`Resumed ${session.id} with *${contact.name}*.`);
      return;
    }
    const session = await this.state.getActiveSession(
      contact.id,
      message.surface,
    );
    if (!session) {
      await reply(
        `No session has started with *${contact.name}*. Send a message to start one.`,
      );
      return;
    }
    if (group === "task" && command === "list") {
      const tasks = await this.state.listTaskRecords(session.id);
      await reply(
        tasks.length
          ? tasks.map((task) => this.describeTask(task)).join("\n")
          : `No Tasks have been recorded in ${session.id}.`,
      );
      return;
    }
    const task =
      group === "task" && command === "current"
        ? (await this.state.listTaskRecords(session.id))[0]
        : group === "task" && command === "status" && argument
          ? await this.state.getTaskRecord(argument)
          : undefined;
    if (
      !task ||
      task.contactId !== contact.id ||
      surfaceKey(task.surface) !== surfaceKey(message.surface)
    ) {
      await reply("Unknown Task. Send `/a2a task list`.");
      return;
    }
    try {
      await reply(
        this.describeTask(
          await this.connector.inspectTask(contact, task),
          true,
        ),
      );
    } catch (error) {
      await reply(
        `${this.describeTask(task, true)}\nRemote status refresh failed: ${(error as Error).message}`,
      );
    }
  }

  private replySink(
    client: App["client"],
    message: SlackMessage,
    contact: Contact,
  ): ReplySink {
    let ts: string | undefined;
    return {
      publishInitial: async (text) => {
        ts = await this.post(client, message, labelAgentReply(contact, text));
      },
      update: async (text) => {
        if (!ts) return;
        await client.chat.update({
          channel: message.channel,
          ts,
          text: labelAgentReply(contact, text).slice(0, maxMessageLength),
        });
      },
    };
  }

  private async post(
    client: App["client"],
    message: SlackMessage,
    text: string,
  ): Promise<string> {
    const response = await client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.threadTs,
      text: text.slice(0, maxMessageLength),
    });
    if (!response.ts)
      throw new Error("Slack did not return a message timestamp.");
    return response.ts;
  }

  private async selectedContact(
    surface: Surface,
    policy?: SlackChannelPolicy,
  ): Promise<Contact | undefined> {
    const selected = this.selectedContactBySurface.get(surfaceKey(surface));
    if (selected) return this.availableContact(selected, policy);
    if (policy?.defaultAgent)
      return this.availableContact(policy.defaultAgent, policy);
    const contacts = await this.availableContacts(policy);
    return contacts.length === 1 ? contacts[0] : undefined;
  }

  private async activeOrNewSession(
    contact: Contact,
    surface: Surface,
  ): Promise<SessionResolution> {
    const active = await this.state.getActiveSession(contact.id, surface);
    if (active) return { kind: "existing", session: active };
    return {
      kind: "created",
      session: await this.createSession(contact, surface),
    };
  }

  private async createSession(
    contact: Contact,
    surface: Surface,
  ): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: `session-${crypto.randomUUID().slice(0, 8)}`,
      contactId: contact.id,
      surface,
      createdAt: now,
      updatedAt: now,
    };
    await this.state.saveSession(session);
    await this.state.selectSession(contact.id, surface, session.id);
    return session;
  }

  private workspaceIntro(contact: Contact, session: Session): string {
    return workspaceIntroduction(
      contact,
      session,
      "@Bridge",
      this.aliasFor(contact) ?? contact.id,
    );
  }

  private surfaceLabel(surface: Surface): string {
    return surface.kind === "dm" ? "DM" : "thread";
  }
  private describeSession(session: Session, detailed: boolean): string {
    const summary = `*${session.id}* — updated ${session.updatedAt}`;
    return detailed
      ? `${summary}\nContext ID: \`${session.contextId ?? "not assigned until the first A2A response"}\`\nStarted: ${session.createdAt}`
      : summary;
  }
  private describeTask(task: TaskRecord, detailed = false): string {
    const summary = `• \`${task.taskId}\` — ${task.state}`;
    return detailed
      ? `Task: \`${task.taskId}\`\nSession: ${task.sessionId}\nState: *${task.state}*\nContext ID: \`${task.contextId ?? "unknown"}\`\nLast checked: ${task.updatedAt}`
      : summary;
  }
  private async syncConfiguredContacts(): Promise<void> {
    await this.contacts.sync(
      this.runtimeConfig
        .snapshot()
        .config.agents.map((agent) => agent.agentCardUrl),
    );
  }
  private async availableContacts(
    policy?: SlackChannelPolicy,
  ): Promise<Contact[]> {
    const contacts = await this.state.listContacts();
    const config = this.runtimeConfig.snapshot().config;
    const configured = config.managesContacts
      ? contacts.filter((contact) =>
          config.agents.some(
            (agent) => agent.agentCardUrl === contact.agentCardUrl,
          ),
        )
      : contacts;
    return policy
      ? configured.filter((contact) =>
          policy.agents.includes(this.aliasFor(contact) ?? ""),
        )
      : configured;
  }
  private async availableContact(
    id: string,
    policy?: SlackChannelPolicy,
  ): Promise<Contact | undefined> {
    return (await this.availableContacts(policy)).find(
      (contact) => contact.id === id || this.aliasFor(contact) === id,
    );
  }
  private aliasFor(contact: Contact): string | undefined {
    return this.runtimeConfig
      .snapshot()
      .config.agents.find(
        (agent) => agent.agentCardUrl === contact.agentCardUrl,
      )?.alias;
  }
}
