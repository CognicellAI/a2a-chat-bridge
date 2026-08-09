import {
  ApplicationIntegrationType,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  InteractionContextType,
  Partials,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type AnyThreadChannel,
  type BaseChannel,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";
import type { A2AConnector } from "../core/a2a-connector.js";
import type { ChannelPolicy } from "../config.js";
import type { ContactRegistry } from "../core/contacts.js";
import type { RuntimeConfig } from "../core/runtime-config.js";
import type { ReplySink, StateStore } from "../core/ports.js";
import type {
  Contact,
  InFlightTask,
  Session,
  Surface,
  TaskRecord,
} from "../domain.js";
import { surfaceKey } from "../domain.js";

const a2aCommand = new SlashCommandBuilder()
  .setName("a2a")
  .setDescription("Control this A2A bridge")
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  )
  .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild)
  .addSubcommandGroup((group) =>
    group
      .setName("contact")
      .setDescription("Inspect or select remote agents")
      .addSubcommand((command) =>
        command.setName("list").setDescription("List available A2A agents"),
      )
      .addSubcommand((command) =>
        command
          .setName("current")
          .setDescription("Show the selected A2A agent"),
      )
      .addSubcommand((command) =>
        command
          .setName("use")
          .setDescription("Select an A2A agent for this conversation")
          .addStringOption((option) =>
            option
              .setName("agent")
              .setDescription("Contact ID or configured alias")
              .setRequired(true),
          ),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("session")
      .setDescription("Manage the selected agent session")
      .addSubcommand((command) =>
        command.setName("new").setDescription("Start a fresh A2A conversation"),
      )
      .addSubcommand((command) =>
        command
          .setName("current")
          .setDescription("Show the selected A2A session metadata"),
      )
      .addSubcommand((command) =>
        command.setName("list").setDescription("List saved A2A sessions"),
      )
      .addSubcommand((command) =>
        command
          .setName("use")
          .setDescription("Return to a saved A2A session")
          .addStringOption((option) =>
            option
              .setName("session")
              .setDescription("Bridge session reference")
              .setRequired(true),
          ),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("task")
      .setDescription("Inspect Tasks started by this bridge")
      .addSubcommand((command) =>
        command.setName("current").setDescription("Inspect the latest Task"),
      )
      .addSubcommand((command) =>
        command.setName("list").setDescription("List Session Tasks"),
      )
      .addSubcommand((command) =>
        command
          .setName("status")
          .setDescription("Refresh a recorded Task's remote status")
          .addStringOption((option) =>
            option
              .setName("task")
              .setDescription("Recorded remote A2A task ID")
              .setRequired(true),
          ),
      ),
  );

export function labelAgentReply(contact: Contact, text: string): string {
  return `**${contact.name}** · A2A agent\n${text}`;
}

export function workspaceIntroduction(
  contact: Contact,
  session: Session,
  botMention: string,
  agentHandle: string,
): string {
  return [
    "**A2A workspace**",
    `Agent: **${contact.name}** (${agentHandle})`,
    `Session: \`${session.id}\``,
    `Send requests by mentioning ${botMention}.`,
  ].join("\n");
}

type SessionResolution =
  | { kind: "existing"; session: Session }
  | { kind: "created"; session: Session };

export class DiscordAdapter {
  private readonly client = new Client({
    intents: [
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
    partials: [Partials.Channel],
  });
  private readonly selectedContactBySurface = new Map<string, string>();

  public constructor(
    private readonly token: string,
    private readonly state: StateStore,
    private readonly contacts: ContactRegistry,
    private readonly connector: A2AConnector,
    private readonly runtimeConfig: RuntimeConfig,
  ) {}

  async start(): Promise<void> {
    await this.syncConfiguredContacts();
    this.runtimeConfig.startPolling(async () => {
      await this.syncConfiguredContacts();
      console.info(
        `Configuration reloaded (revision ${this.runtimeConfig.snapshot().revision}).`,
      );
    });
    this.client.once(Events.ClientReady, (ready) => {
      console.info(`Connected to Discord as ${ready.user.tag}.`);
      void this.registerCommands().catch((error: unknown) =>
        console.error("Could not register Discord commands:", error),
      );
      void this.connector
        .recover((task) => this.recoverySink(task))
        .then((unavailable) => {
          const skippedByContact = new Map<
            string,
            { name: string; count: number }
          >();
          for (const { contact } of unavailable) {
            const skipped = skippedByContact.get(contact.id);
            if (skipped) {
              skipped.count += 1;
              continue;
            }
            skippedByContact.set(contact.id, { name: contact.name, count: 1 });
          }
          for (const { name, count } of skippedByContact.values()) {
            console.info(
              `Task recovery unavailable for ${name}: task resubscription is not supported; skipped ${count} in-flight task${count === 1 ? "" : "s"}.`,
            );
          }
        })
        .catch((error: unknown) =>
          console.error("A2A task recovery failed:", error),
        );
    });
    this.client.on(
      Events.MessageCreate,
      (message) => void this.handle(message),
    );
    this.client.on(Events.InteractionCreate, (interaction) => {
      if (interaction.isChatInputCommand())
        void this.handleCommand(interaction);
    });
    await this.client.login(this.token);
  }

  private surface(message: Message): Surface {
    return { platform: "discord", kind: "dm", id: message.channelId };
  }

  private threadSurface(channel: AnyThreadChannel): Surface {
    return { platform: "discord", kind: "thread", id: channel.id };
  }

  private threadPolicy(channel: BaseChannel): ChannelPolicy | undefined {
    if (
      !channel.isThread() ||
      channel.type !== ChannelType.PublicThread ||
      channel.parentId === null
    )
      return undefined;
    return this.runtimeConfig
      .snapshot()
      .config.discord.channels.find((policy) => policy.id === channel.parentId);
  }

  private isEligibleThread(channel: BaseChannel): channel is AnyThreadChannel {
    return channel.isThread() && this.threadPolicy(channel) !== undefined;
  }

  private commandScope(
    interaction: ChatInputCommandInteraction,
  ): { surface: Surface; policy?: ChannelPolicy } | undefined {
    if (!interaction.channel) return undefined;
    if (interaction.channel.isDMBased())
      return {
        surface: { platform: "discord", kind: "dm", id: interaction.channelId },
      };
    const policy = this.threadPolicy(interaction.channel);
    if (policy && this.isEligibleThread(interaction.channel))
      return { surface: this.threadSurface(interaction.channel), policy };
    return undefined;
  }

  private canMutate(
    interaction: ChatInputCommandInteraction,
    surface: Surface,
  ): boolean {
    if (surface.kind === "dm") return true;
    const channel = interaction.channel;
    return (
      channel !== null &&
      "isThread" in channel &&
      channel.isThread() &&
      this.isEligibleThread(channel) &&
      (channel.ownerId === interaction.user.id ||
        interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageThreads,
        ) === true)
    );
  }

  private async requireMutationPermission(
    interaction: ChatInputCommandInteraction,
    surface: Surface,
  ): Promise<boolean> {
    if (this.canMutate(interaction, surface)) return true;
    await interaction.reply(
      "Only this thread's starter or a member with **Manage Threads** can change its A2A agent or Session.",
    );
    return false;
  }

  private replySink(message: Message, contact: Contact): ReplySink {
    let reply: Message | undefined;
    return {
      publishInitial: async (text) => {
        reply = await message.reply(
          labelAgentReply(contact, text).slice(0, 2_000),
        );
      },
      update: async (text) => {
        if (reply)
          await reply.edit(labelAgentReply(contact, text).slice(0, 2_000));
      },
    };
  }

  private recoverySink(task: InFlightTask): ReplySink | undefined {
    if (task.surface.platform !== "discord") return undefined;
    let reply: Message | undefined;
    return {
      publishInitial: async () => undefined,
      update: async (text) => {
        if (reply) {
          await reply.edit(text.slice(0, 2_000));
          return;
        }
        const channel = await this.client.channels.fetch(task.surface.id);
        if (!channel?.isSendable())
          throw new Error("The recovered Discord conversation is unavailable.");
        reply = await channel.send(text.slice(0, 2_000));
      },
    };
  }

  private async handle(message: Message): Promise<void> {
    if (message.author.bot) return;
    const policy = message.channel.isDMBased()
      ? undefined
      : this.threadPolicy(message.channel);
    const surface = message.channel.isDMBased()
      ? this.surface(message)
      : policy && this.isEligibleThread(message.channel)
        ? this.threadSurface(message.channel)
        : undefined;
    if (!surface) return;

    const content =
      surface.kind === "thread"
        ? this.threadMessageContent(message)
        : message.content.trim();
    if (!content) return;

    const contact = await this.selectedContact(surface, policy);
    if (!contact) {
      await message.reply(
        "No A2A agent is selected. Use `/a2a contact list` in Discord's command picker.",
      );
      return;
    }
    const resolution = await this.activeOrNewSession(contact, surface);
    if (resolution.kind === "created" && surface.kind === "thread")
      await message.reply(this.workspaceIntro(contact, resolution.session));
    try {
      await this.connector.send(
        contact,
        resolution.session,
        content,
        this.replySink(message, contact),
      );
    } catch (error) {
      await message.reply(`A2A request failed: ${(error as Error).message}`);
    }
  }

  private async registerCommands(): Promise<void> {
    const application = this.client.application;
    if (!application) throw new Error("Discord application is unavailable.");
    await application.commands.set([a2aCommand]);
    console.info("Registered /a2a Discord application command.");
  }

  private async handleCommand(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (interaction.commandName !== "a2a") return;
    const scope = this.commandScope(interaction);
    if (!scope) {
      await interaction.reply(
        "Use this command in a direct message or an allowlisted public thread.",
      );
      return;
    }
    const { surface, policy } = scope;

    const group = interaction.options.getSubcommandGroup(true);
    const command = interaction.options.getSubcommand(true);
    if (group === "contact" && command === "list") {
      const contacts = await this.availableContacts(policy);
      await interaction.reply(
        contacts.length
          ? contacts
              .map(
                (contact) =>
                  `• ${this.aliasFor(contact) ?? contact.id} — ${contact.name}${this.aliasFor(contact) ? ` (${contact.id})` : ""}`,
              )
              .join("\n")
          : "No configured A2A agents are currently available.",
      );
      return;
    }

    if (group === "contact" && command === "current") {
      const contact = await this.selectedContact(surface, policy);
      await interaction.reply(
        contact
          ? `This ${this.surfaceLabel(surface)} is using **${contact.name}** (${this.aliasFor(contact) ?? contact.id}).\nAgent Card: <${contact.agentCardUrl}>`
          : "No A2A agent is selected. Run `/a2a contact list`, then `/a2a contact use`.",
      );
      return;
    }

    if (group === "contact" && command === "use") {
      if (!(await this.requireMutationPermission(interaction, surface))) return;
      const identifier = interaction.options.getString("agent", true);
      const contact = await this.availableContact(identifier, policy);
      if (!contact) {
        await interaction.reply(
          `Unknown A2A agent ${identifier}. Run \`/a2a contact list\`.`,
        );
        return;
      }
      this.selectedContactBySurface.set(surfaceKey(surface), contact.id);
      await interaction.reply(
        `Selected **${contact.name}** (${this.aliasFor(contact) ?? contact.id}) for this ${this.surfaceLabel(surface)}.`,
      );
      return;
    }

    if (group === "session" && command === "new") {
      if (!(await this.requireMutationPermission(interaction, surface))) return;
      const contact = await this.selectedContact(surface, policy);
      if (!contact) {
        await interaction.reply(
          "No A2A agent is selected. Run `/a2a contact list`, then `/a2a contact use`.",
        );
        return;
      }
      const current = await this.state.getActiveSession(contact.id, surface);
      const session = await this.createSession(contact, surface);
      await interaction.reply(
        surface.kind === "thread"
          ? this.workspaceIntro(contact, session)
          : current
            ? `Archived ${current.id} and started ${session.id} with **${contact.name}**. This does not cancel any already-running remote task.`
            : `Started ${session.id} with **${contact.name}**.`,
      );
      return;
    }

    if (group === "session" && command === "current") {
      const contact = await this.selectedContact(surface, policy);
      if (!contact) {
        await interaction.reply(
          `No A2A agent is selected for this ${this.surfaceLabel(surface)}.`,
        );
        return;
      }
      const session = await this.state.getActiveSession(contact.id, surface);
      await interaction.reply(
        session
          ? this.describeSession(session, true)
          : `No session has started with **${contact.name}**. Send a message to start one.`,
      );
      return;
    }

    if (group === "session" && command === "list") {
      const contact = await this.selectedContact(surface, policy);
      if (!contact) {
        await interaction.reply(
          `No A2A agent is selected for this ${this.surfaceLabel(surface)}.`,
        );
        return;
      }
      const [sessions, active] = await Promise.all([
        this.state.listSessions(contact.id, surface),
        this.state.getActiveSession(contact.id, surface),
      ]);
      await interaction.reply(
        sessions.length
          ? sessions
              .map(
                (session) =>
                  `${session.id === active?.id ? "• **active**" : "•"} ${this.describeSession(session, false)}`,
              )
              .join("\n")
          : `No saved sessions for this A2A agent in this ${this.surfaceLabel(surface)}.`,
      );
      return;
    }

    if (group === "session" && command === "use") {
      if (!(await this.requireMutationPermission(interaction, surface))) return;
      const contact = await this.selectedContact(surface, policy);
      const sessionId = interaction.options.getString("session", true);
      if (!contact) {
        await interaction.reply(
          `No A2A agent is selected for this ${this.surfaceLabel(surface)}.`,
        );
        return;
      }
      const session = await this.state.getSession(sessionId);
      if (
        !session ||
        session.contactId !== contact.id ||
        surfaceKey(session.surface) !== surfaceKey(surface)
      ) {
        await interaction.reply(
          `Unknown session ${sessionId}. Run \`/a2a session list\`.`,
        );
        return;
      }
      await this.state.selectSession(contact.id, surface, session.id);
      await interaction.reply(
        `Resumed ${session.id} with **${contact.name}**.`,
      );
      return;
    }

    if (group === "task" && command === "list") {
      const session = await this.currentSession(interaction, surface, policy);
      if (!session) return;
      const tasks = await this.state.listTaskRecords(session.id);
      await interaction.reply(
        tasks.length
          ? tasks.map((task) => this.describeTask(task)).join("\n")
          : `No Tasks have been recorded in ${session.id}.`,
      );
      return;
    }

    if (group === "task" && command === "current") {
      const session = await this.currentSession(interaction, surface, policy);
      if (!session) return;
      const task = (await this.state.listTaskRecords(session.id))[0];
      if (!task) {
        await interaction.reply(
          `No Tasks have been recorded in ${session.id}.`,
        );
        return;
      }
      await this.replyTaskInspection(interaction, task);
      return;
    }

    if (group === "task" && command === "status") {
      const taskId = interaction.options.getString("task", true);
      const task = await this.state.getTaskRecord(taskId);
      const contact = await this.selectedContact(surface, policy);
      if (
        !task ||
        !contact ||
        task.contactId !== contact.id ||
        surfaceKey(task.surface) !== surfaceKey(surface)
      ) {
        await interaction.reply(
          `Unknown Task ${taskId}. Run \`/a2a task list\` in the relevant session.`,
        );
        return;
      }
      await this.replyTaskInspection(interaction, task);
    }
  }

  private async selectedContact(
    surface: Surface,
    policy?: ChannelPolicy,
  ): Promise<Contact | undefined> {
    const selected = this.selectedContactBySurface.get(surfaceKey(surface));
    if (selected) return this.availableContact(selected, policy);
    if (policy?.defaultAgent)
      return this.availableContact(policy.defaultAgent, policy);
    const contacts = await this.availableContacts(policy);
    return contacts.length === 1 ? contacts[0] : undefined;
  }

  private surfaceLabel(surface: Surface): string {
    return surface.kind === "dm" ? "DM" : "thread";
  }

  private threadMessageContent(message: Message): string {
    const bot = this.client.user;
    if (!bot || !message.mentions.has(bot)) return "";
    return message.content
      .replaceAll(`<@${bot.id}>`, "")
      .replaceAll(`<@!${bot.id}>`, "")
      .trim();
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

  private workspaceIntro(contact: Contact, session: Session): string {
    const botMention = this.client.user
      ? `<@${this.client.user.id}>`
      : "the bridge bot";
    return workspaceIntroduction(
      contact,
      session,
      botMention,
      this.aliasFor(contact) ?? contact.id,
    );
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

  private async currentSession(
    interaction: ChatInputCommandInteraction,
    surface: Surface,
    policy?: ChannelPolicy,
  ): Promise<Session | undefined> {
    const contact = await this.selectedContact(surface, policy);
    if (!contact) {
      await interaction.reply(
        `No A2A agent is selected for this ${this.surfaceLabel(surface)}.`,
      );
      return undefined;
    }
    const session = await this.state.getActiveSession(contact.id, surface);
    if (!session)
      await interaction.reply(
        `No session has started with **${contact.name}**. Send a message to start one.`,
      );
    return session;
  }

  private async replyTaskInspection(
    interaction: ChatInputCommandInteraction,
    task: TaskRecord,
  ): Promise<void> {
    const contact = await this.state.getContact(task.contactId);
    if (!contact) {
      await interaction.reply(
        "The Contact for this recorded Task is unavailable.",
      );
      return;
    }
    try {
      await interaction.reply(
        this.describeTask(
          await this.connector.inspectTask(contact, task),
          true,
        ),
      );
    } catch (error) {
      await interaction.reply(
        `${this.describeTask(task, true)}\nRemote status refresh failed: ${(error as Error).message}`,
      );
    }
  }

  private describeSession(session: Session, detailed: boolean): string {
    const summary = `**${session.id}** — updated ${session.updatedAt}`;
    if (!detailed) return summary;
    return `${summary}\nContext ID: \`${session.contextId ?? "not assigned until the first A2A response"}\`\nStarted: ${session.createdAt}`;
  }

  private describeTask(task: TaskRecord, detailed = false): string {
    const summary = `• \`${task.taskId}\` — ${task.state}`;
    if (!detailed) return summary;
    return `Task: \`${task.taskId}\`\nSession: ${task.sessionId}\nState: **${task.state}**\nContext ID: \`${task.contextId ?? "unknown"}\`\nLast checked: ${task.updatedAt}`;
  }

  private async syncConfiguredContacts(): Promise<void> {
    await this.contacts.sync(
      this.runtimeConfig
        .snapshot()
        .config.agents.map((agent) => agent.agentCardUrl),
    );
  }

  private async availableContacts(policy?: ChannelPolicy): Promise<Contact[]> {
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
    policy?: ChannelPolicy,
  ): Promise<Contact | undefined> {
    const contacts = await this.availableContacts(policy);
    return contacts.find(
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
