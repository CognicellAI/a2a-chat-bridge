import { App, LogLevel, type RespondFn, type SlashCommand } from "@slack/bolt";
import type { KnownBlock } from "@slack/types";
import type { SlackConversationPolicy } from "../config.js";
import type { A2AConnector } from "../core/a2a-connector.js";
import type { ContactRegistry } from "../core/contacts.js";
import type { RuntimeConfig } from "../core/runtime-config.js";
import {
  commandHelp,
  parseWorkspaceCommand,
  type CommandResult,
  type CommandScope,
  type WorkspaceCommand,
  WorkspaceCommands,
} from "../core/workspace-commands.js";
import type { ReplySink, StateStore } from "../core/ports.js";
import type { Contact, Session, Surface, TaskRecord } from "../domain.js";
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
  readonly policy?: SlackConversationPolicy;
}

interface SlackAction {
  readonly action_id: string;
  readonly value?: string;
  readonly selected_option?: { readonly value: string };
}

interface SlackActionBody {
  readonly user: { readonly id: string };
  readonly channel?: { readonly id: string };
  readonly container?: {
    readonly channel_id?: string;
    readonly message_ts?: string;
  };
  readonly actions: readonly SlackAction[];
}

const maxMessageLength = 4_000;
export type SlackConversationKind = "dm" | "group-dm" | "channel";

export const slackConversationKind = (conversation: {
  readonly is_im?: boolean;
  readonly is_mpim?: boolean;
  readonly is_channel?: boolean;
  readonly is_group?: boolean;
}): SlackConversationKind | undefined => {
  if (conversation.is_im) return "dm";
  if (conversation.is_mpim) return "group-dm";
  if (conversation.is_channel || conversation.is_group) return "channel";
  return undefined;
};

export class SlackAdapter {
  private readonly app: App;

  public constructor(
    botToken: string,
    appToken: string,
    private readonly state: StateStore,
    private readonly contacts: ContactRegistry,
    private readonly connector: A2AConnector,
    private readonly runtimeConfig: RuntimeConfig,
    private readonly workspaceCommands: WorkspaceCommands,
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
    this.app.event("app_mention", async ({ event, client }) =>
      this.handleMention(event as SlackEvent, client),
    );
    this.app.event("message", async ({ event, client }) => {
      const message = event as SlackEvent;
      if (message.channel_type === "im" || message.channel_type === "mpim")
        await this.handleDirect(message, client);
    });
    this.app.command("/a2a", async ({ command, ack, client, respond }) => {
      await ack();
      await this.handleNativeCommand(command, client, respond);
    });
    this.app.action(/a2a_.+/, async ({ ack, body, client, respond }) => {
      await ack();
      await this.handleAction(
        body as unknown as SlackActionBody,
        client,
        respond,
      );
    });
    await this.app.start();
    console.info("Connected to Slack through Socket Mode.");
  }

  private policy(channel: string): SlackConversationPolicy | undefined {
    return this.runtimeConfig
      .snapshot()
      .config.slack?.conversations.find(
        (candidate) => candidate.id === channel,
      );
  }

  private scope(
    surface: Surface,
    policy: SlackConversationPolicy | undefined,
  ): CommandScope {
    return {
      surface,
      agentAliases: policy?.agents,
      defaultAgent: policy?.defaultAgent,
    };
  }

  private async handleDirect(
    event: SlackEvent,
    client: App["client"],
  ): Promise<void> {
    if (!event.user || event.bot_id || event.subtype || !event.text) return;
    const kind = event.channel_type === "mpim" ? "group-dm" : "dm";
    const policy = kind === "group-dm" ? this.policy(event.channel) : undefined;
    if (kind === "group-dm" && !policy) {
      await client.chat.postMessage({
        channel: event.channel,
        text: "This group DM is not configured for A2A. Ask an operator to add its conversation ID to `slack.conversations`.",
      });
      return;
    }
    await this.handle(
      {
        channel: event.channel,
        user: event.user,
        text: event.text.trim(),
        policy,
        surface: { platform: "slack", kind, id: event.channel },
      },
      client,
    );
  }

  private async conversationKind(
    client: App["client"],
    channel: string,
  ): Promise<SlackConversationKind | undefined> {
    const response = await client.conversations.info({ channel });
    const conversation = response.channel;
    return conversation ? slackConversationKind(conversation) : undefined;
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
    const parsed = parseWorkspaceCommand(`/a2a ${command.text}`);
    if (!parsed) {
      await respond({
        response_type: "ephemeral",
        text: commandHelp,
      });
      return;
    }
    const kind = await this.conversationKind(client, command.channel_id);
    if (!kind) {
      await respond({
        response_type: "ephemeral",
        text: "This Slack conversation type is unavailable for A2A.",
      });
      return;
    }
    const policy = kind === "dm" ? undefined : this.policy(command.channel_id);
    if (kind === "group-dm" && !policy) {
      await respond({
        response_type: "ephemeral",
        text: "This group DM is not configured for A2A. Ask an operator to add its conversation ID to `slack.conversations`.",
      });
      return;
    }
    if (kind === "dm" || kind === "group-dm") {
      const message: SlackMessage = {
        channel: command.channel_id,
        user: command.user_id,
        text: "",
        policy,
        surface: { platform: "slack", kind, id: command.channel_id },
      };
      const result = await this.workspaceCommands.execute(
        parsed,
        this.scope(message.surface, message.policy),
      );
      await respond({
        response_type: "ephemeral",
        text: this.render(result, message.surface),
      });
      if (kind === "group-dm" && this.isWorkspaceChange(result))
        await this.post(
          client,
          message,
          this.auditMessage(command.user_id, result),
        );
      if (result.kind === "session-new" && result.initialRequest)
        await this.sendRequest(
          message,
          client,
          result.agent,
          result.session,
          result.initialRequest,
        );
      return;
    }
    if (!policy) {
      await respond({
        response_type: "ephemeral",
        text: "Use `/a2a` in a conversation configured for this bridge.",
      });
      return;
    }
    if (parsed.group === "agent" && parsed.action === "list") {
      const result = await this.workspaceCommands.execute(
        parsed,
        this.scope(
          { platform: "slack", kind: "thread", id: command.channel_id },
          policy,
        ),
      );
      await respond({
        response_type: "ephemeral",
        text: this.render(result, {
          platform: "slack",
          kind: "thread",
          id: command.channel_id,
        }),
      });
      return;
    }
    if (parsed.group !== "session" || parsed.action !== "new") {
      await respond({
        response_type: "ephemeral",
        text: "Slack native `/a2a` launches workspaces only. Open the workspace thread to inspect or change A2A state.",
      });
      return;
    }
    const root = await client.chat.postMessage({
      channel: command.channel_id,
      text: "A2A workspace is starting…",
    });
    if (!root.ts)
      throw new Error("Slack did not return a workspace timestamp.");
    const message = this.workspaceMessage(
      command.channel_id,
      root.ts,
      command.user_id,
      policy,
    );
    const result = await this.workspaceCommands.execute(
      parsed,
      this.scope(message.surface, policy),
    );
    if (result.kind !== "session-new") {
      await client.chat.update({
        channel: command.channel_id,
        ts: root.ts,
        text: this.render(result, message.surface),
      });
      await respond({
        response_type: "ephemeral",
        text: this.render(result, message.surface),
      });
      return;
    }
    await this.updateHeader(
      client,
      command.channel_id,
      root.ts,
      root.ts,
      result.agent,
      result.session,
      policy,
    );
    await client.chat.postMessage({
      channel: command.channel_id,
      thread_ts: root.ts,
      text: this.auditMessage(command.user_name || command.user_id, result),
    });
    await respond({
      response_type: "ephemeral",
      text: `Started a ${result.agent.name} workspace thread.`,
    });
    if (result.initialRequest)
      await this.sendRequest(
        message,
        client,
        result.agent,
        result.session,
        result.initialRequest,
      );
  }

  private async handle(
    message: SlackMessage,
    client: App["client"],
  ): Promise<void> {
    if (message.text.startsWith("/a2a")) {
      await this.handleControl(message, client);
      return;
    }
    const scope = this.scope(message.surface, message.policy);
    const agent = await this.workspaceCommands.selectedAgent(scope);
    if (!agent) {
      await this.post(
        client,
        message,
        "No A2A agent is selected. Send `/a2a agent list`, then `/a2a agent use <agent>`.",
      );
      return;
    }
    let session = await this.state.getActiveSession(agent.id, message.surface);
    if (!session) {
      const created = await this.workspaceCommands.execute(
        { group: "session", action: "new", arguments: [] },
        scope,
      );
      if (created.kind !== "session-new") {
        await this.post(client, message, this.render(created, message.surface));
        return;
      }
      session = created.session;
      if (message.surface.kind === "thread")
        await this.postHeader(client, message, agent, session);
    }
    await this.sendRequest(message, client, agent, session, message.text);
  }

  private async handleControl(
    message: SlackMessage,
    client: App["client"],
  ): Promise<void> {
    const parsed = parseWorkspaceCommand(message.text);
    if (!parsed) {
      await this.post(client, message, commandHelp);
      return;
    }
    const result = await this.workspaceCommands.execute(
      parsed,
      this.scope(message.surface, message.policy),
    );
    await this.post(client, message, this.render(result, message.surface));
    if (this.isWorkspaceChange(result))
      await this.post(client, message, this.auditMessage(message.user, result));
    if (result.kind === "session-new" && result.initialRequest)
      await this.sendRequest(
        message,
        client,
        result.agent,
        result.session,
        result.initialRequest,
      );
    if (
      message.surface.kind === "thread" &&
      (result.kind === "agent-selected" ||
        result.kind === "session-new" ||
        result.kind === "session-selected")
    ) {
      const agent = result.agent;
      const session =
        result.kind === "session-new" || result.kind === "session-selected"
          ? result.session
          : await this.state.getActiveSession(agent.id, message.surface);
      if (session) await this.postHeader(client, message, agent, session);
    }
  }

  private async handleAction(
    body: SlackActionBody,
    client: App["client"],
    respond: RespondFn,
  ): Promise<void> {
    const action = body.actions[0];
    const channel = body.channel?.id ?? body.container?.channel_id;
    const threadedValue = action.value ?? action.selected_option?.value;
    const workspaceThreadTs =
      threadedValue?.split("::", 1)[0] ?? body.container?.message_ts;
    const headerTs = body.container?.message_ts;
    if (!action || !channel || !workspaceThreadTs || !headerTs) return;
    const policy = this.policy(channel);
    if (!policy) {
      await respond({
        response_type: "ephemeral",
        text: "This channel is no longer configured for A2A.",
      });
      return;
    }
    const message = this.workspaceMessage(
      channel,
      workspaceThreadTs,
      body.user.id,
      policy,
    );
    const command = this.actionCommand(action);
    if (!command) return;
    const result = await this.workspaceCommands.execute(
      command,
      this.scope(message.surface, policy),
    );
    await respond({
      response_type: "ephemeral",
      text: this.render(result, message.surface),
    });
    if (this.isWorkspaceChange(result))
      await this.post(client, message, this.auditMessage(body.user.id, result));
    if (
      result.kind === "agent-selected" ||
      result.kind === "session-new" ||
      result.kind === "session-selected"
    ) {
      const agent = result.agent;
      const session =
        result.kind === "agent-selected"
          ? await this.state.getActiveSession(agent.id, message.surface)
          : result.session;
      if (session)
        await this.updateHeader(
          client,
          channel,
          headerTs,
          workspaceThreadTs,
          agent,
          session,
          policy,
        );
    }
  }

  private actionCommand(action: SlackAction): WorkspaceCommand | undefined {
    switch (action.action_id) {
      case "a2a_agent_list":
        return { group: "agent", action: "list" };
      case "a2a_agent_current":
        return { group: "agent", action: "current" };
      case "a2a_agent_select":
        return action.selected_option
          ? {
              group: "agent",
              action: "use",
              agent: action.selected_option.value
                .split("::")
                .slice(1)
                .join("::"),
            }
          : undefined;
      case "a2a_session_new":
        return { group: "session", action: "new", arguments: [] };
      case "a2a_session_current":
        return { group: "session", action: "current" };
      case "a2a_session_list":
        return { group: "session", action: "list" };
      case "a2a_session_select": {
        const value = action.selected_option?.value;
        if (value?.endsWith("::__none__"))
          return { group: "session", action: "list" };
        return value
          ? {
              group: "session",
              action: "use",
              session: value.split("::").slice(1).join("::"),
            }
          : undefined;
      }
      case "a2a_task_current":
        return { group: "task", action: "current" };
      case "a2a_task_list":
        return { group: "task", action: "list" };
      case "a2a_task_status": {
        const value = action.selected_option?.value;
        if (value?.endsWith("::__none__"))
          return { group: "task", action: "list" };
        return value
          ? {
              group: "task",
              action: "status",
              task: value.split("::").slice(1).join("::"),
            }
          : undefined;
      }
      default:
        return undefined;
    }
  }

  private workspaceMessage(
    channel: string,
    threadTs: string,
    user: string,
    policy: SlackConversationPolicy,
  ): SlackMessage {
    return {
      channel,
      threadTs,
      user,
      text: "",
      policy,
      surface: {
        platform: "slack",
        kind: "thread",
        id: `${channel}:${threadTs}`,
      },
    };
  }

  private async sendRequest(
    message: SlackMessage,
    client: App["client"],
    agent: Contact,
    session: Session,
    request: string,
  ): Promise<void> {
    try {
      await this.connector.send(
        agent,
        session,
        request,
        this.replySink(client, message, agent),
      );
    } catch (error) {
      await this.post(
        client,
        message,
        `A2A request failed: ${(error as Error).message}`,
      );
    }
  }

  private replySink(
    client: App["client"],
    message: SlackMessage,
    agent: Contact,
  ): ReplySink {
    let ts: string | undefined;
    return {
      publishInitial: async (text) => {
        ts = await this.post(client, message, labelAgentReply(agent, text));
      },
      update: async (text) => {
        if (ts)
          await client.chat.update({
            channel: message.channel,
            ts,
            text: labelAgentReply(agent, text).slice(0, maxMessageLength),
          });
      },
    };
  }

  private async postHeader(
    client: App["client"],
    message: SlackMessage,
    agent: Contact,
    session: Session,
  ): Promise<void> {
    const response = await client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.threadTs,
      text: `A2A workspace — ${agent.name}`,
      blocks: await this.headerBlocks(
        agent,
        session,
        message.policy,
        message.threadTs ?? message.surface.id.split(":").at(-1)!,
      ),
    });
    if (!response.ts)
      throw new Error("Slack did not return a workspace header timestamp.");
  }

  private async updateHeader(
    client: App["client"],
    channel: string,
    headerTs: string,
    workspaceThreadTs: string,
    agent: Contact,
    session: Session,
    policy: SlackConversationPolicy,
  ): Promise<void> {
    await client.chat.update({
      channel,
      ts: headerTs,
      text: `A2A workspace — ${agent.name}`,
      blocks: await this.headerBlocks(
        agent,
        session,
        policy,
        workspaceThreadTs,
      ),
    });
  }

  private async headerBlocks(
    agent: Contact,
    session: Session,
    policy: SlackConversationPolicy | undefined,
    threadTs: string,
  ): Promise<KnownBlock[]> {
    const agents = await this.workspaceCommands.availableAgents({
      surface: session.surface,
      agentAliases: policy?.agents,
      defaultAgent: policy?.defaultAgent,
    });
    const [sessions, tasks] = await Promise.all([
      this.state.listSessions(agent.id, session.surface),
      this.state.listTaskRecords(session.id),
    ]);
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*A2A workspace*\n*Agent:* ${agent.name} (${this.aliasFor(agent) ?? agent.id})\n*Session:* \`${session.id}\``,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "static_select",
            action_id: "a2a_agent_select",
            placeholder: { type: "plain_text", text: "Select agent" },
            options: agents.map((candidate) => ({
              text: {
                type: "plain_text",
                text: `${this.aliasFor(candidate) ?? candidate.id} — ${candidate.name}`.slice(
                  0,
                  75,
                ),
              },
              value: `${threadTs}::${this.aliasFor(candidate) ?? candidate.id}`,
            })),
          },
          {
            type: "button",
            action_id: "a2a_agent_current",
            value: threadTs,
            text: { type: "plain_text", text: "Agent" },
          },
          {
            type: "button",
            action_id: "a2a_agent_list",
            value: threadTs,
            text: { type: "plain_text", text: "Agents" },
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "static_select",
            action_id: "a2a_session_select",
            placeholder: { type: "plain_text", text: "Resume session" },
            options: sessions.length
              ? sessions.slice(0, 100).map((candidate) => ({
                  text: { type: "plain_text" as const, text: candidate.id },
                  value: `${threadTs}::${candidate.id}`,
                }))
              : [
                  {
                    text: {
                      type: "plain_text" as const,
                      text: "No saved sessions",
                    },
                    value: `${threadTs}::__none__`,
                  },
                ],
          },
          {
            type: "button",
            action_id: "a2a_session_current",
            value: threadTs,
            text: { type: "plain_text", text: "Session" },
          },
          {
            type: "button",
            action_id: "a2a_session_new",
            value: threadTs,
            text: { type: "plain_text", text: "New session" },
          },
          {
            type: "button",
            action_id: "a2a_session_list",
            value: threadTs,
            text: { type: "plain_text", text: "Sessions" },
          },
          {
            type: "button",
            action_id: "a2a_session_list",
            value: threadTs,
            text: { type: "plain_text", text: "Sessions" },
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "static_select",
            action_id: "a2a_task_status",
            placeholder: { type: "plain_text", text: "Refresh task" },
            options: tasks.length
              ? tasks.slice(0, 100).map((task) => ({
                  text: {
                    type: "plain_text" as const,
                    text: `${task.taskId} — ${task.state}`.slice(0, 75),
                  },
                  value: `${threadTs}::${task.taskId}`,
                }))
              : [
                  {
                    text: {
                      type: "plain_text" as const,
                      text: "No recorded tasks",
                    },
                    value: `${threadTs}::__none__`,
                  },
                ],
          },
          {
            type: "button",
            action_id: "a2a_task_current",
            value: threadTs,
            text: { type: "plain_text", text: "Task" },
          },
          {
            type: "button",
            action_id: "a2a_task_list",
            value: threadTs,
            text: { type: "plain_text", text: "Tasks" },
          },
        ],
      },
    ];
  }

  private render(result: CommandResult, surface: Surface): string {
    switch (result.kind) {
      case "error":
        return result.message;
      case "agent-list":
        return result.agents.length
          ? result.agents
              .map(
                (agent) =>
                  `• ${this.aliasFor(agent) ?? agent.id} — ${agent.name}`,
              )
              .join("\n")
          : "No configured A2A agents are currently available.";
      case "agent-current":
        return result.agent
          ? `This ${surface.kind === "thread" ? "thread" : surface.kind === "group-dm" ? "group DM" : "DM"} is using *${result.agent.name}* (${this.aliasFor(result.agent) ?? result.agent.id}).\nAgent Card: ${result.agent.agentCardUrl}`
          : "No A2A agent is selected. Run `/a2a agent list`, then `/a2a agent use <agent>`.";
      case "agent-selected":
        return `Selected *${result.agent.name}* (${this.aliasFor(result.agent) ?? result.agent.id}).`;
      case "session-new":
        return `Started ${result.session.id} with *${result.agent.name}*.`;
      case "session-current":
        return result.session
          ? this.describeSession(result.session, true)
          : `No session has started with *${result.agent.name}*.`;
      case "session-list":
        return result.sessions.length
          ? result.sessions
              .map(
                (session) =>
                  `${session.id === result.active?.id ? "• *active*" : "•"} ${this.describeSession(session, false)}`,
              )
              .join("\n")
          : "No saved sessions for this A2A agent.";
      case "session-selected":
        return `Resumed ${result.session.id} with *${result.agent.name}*.`;
      case "task-list":
        return result.tasks.length
          ? result.tasks.map((task) => this.describeTask(task)).join("\n")
          : `No Tasks have been recorded in ${result.session.id}.`;
      case "task-current":
        return `No Tasks have been recorded in ${result.session.id}.`;
      case "task-status":
        return `${this.describeTask(result.task, true)}${result.refreshError ? `\nRemote status refresh failed: ${result.refreshError}` : ""}`;
    }
  }

  private isWorkspaceChange(
    result: CommandResult,
  ): result is Extract<
    CommandResult,
    { kind: "agent-selected" | "session-new" | "session-selected" }
  > {
    return (
      result.kind === "agent-selected" ||
      result.kind === "session-new" ||
      result.kind === "session-selected"
    );
  }

  private auditMessage(
    actor: string,
    result: Extract<
      CommandResult,
      { kind: "agent-selected" | "session-new" | "session-selected" }
    >,
  ): string {
    if (result.kind === "agent-selected")
      return `A2A workspace update: <@${actor}> selected *${result.agent.name}*.`;
    if (result.kind === "session-selected")
      return `A2A workspace update: <@${actor}> resumed \`${result.session.id}\`.`;
    return `A2A workspace update: <@${actor}> started \`${result.session.id}\` with *${result.agent.name}*.`;
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

  private workspaceIntro(contact: Contact, session: Session): string {
    return workspaceIntroduction(
      contact,
      session,
      "@A2ABridge",
      this.aliasFor(contact) ?? contact.id,
    );
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

  private aliasFor(contact: Contact): string | undefined {
    return this.workspaceCommands.aliasFor(contact);
  }

  private async syncConfiguredContacts(): Promise<void> {
    await this.contacts.sync(
      this.runtimeConfig
        .snapshot()
        .config.agents.map((agent) => agent.agentCardUrl),
    );
  }
}
