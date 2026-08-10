import {
  ApplicationIntegrationType,
  Client,
  Events,
  GatewayIntentBits,
  InteractionContextType,
  Partials,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
  type AnyThreadChannel,
  type BaseChannel,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";
import type { A2AConnector } from "../core/a2a-connector.js";
import type { ChannelPolicy, DirectMessagePolicy } from "../config.js";
import type { ContactRegistry } from "../core/contacts.js";
import type { RuntimeConfig } from "../core/runtime-config.js";
import {
  type CommandResult,
  type CommandScope,
  type WorkspaceCommand,
  WorkspaceCommands,
} from "../core/workspace-commands.js";
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
      .setName("agent")
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
        command
          .setName("new")
          .setDescription("Start a fresh A2A conversation or workspace")
          .addStringOption((option) =>
            option
              .setName("agent")
              .setDescription("Optional configured agent alias"),
          )
          .addStringOption((option) =>
            option
              .setName("request")
              .setDescription("Optional first request for a new workspace"),
          ),
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

  public constructor(
    private readonly token: string,
    private readonly state: StateStore,
    private readonly contacts: ContactRegistry,
    private readonly connector: A2AConnector,
    private readonly runtimeConfig: RuntimeConfig,
    private readonly workspaceCommands: WorkspaceCommands,
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
    if (!channel.isThread() || channel.parentId === null) return undefined;
    return this.runtimeConfig
      .snapshot()
      .config.discord?.channels.find(
        (policy) => policy.id === channel.parentId,
      );
  }

  private directMessagePolicy(): DirectMessagePolicy | undefined {
    return this.runtimeConfig.snapshot().config.directMessages;
  }

  private isEligibleThread(channel: BaseChannel): channel is AnyThreadChannel {
    return channel.isThread() && this.threadPolicy(channel) !== undefined;
  }

  private commandScope(
    interaction: ChatInputCommandInteraction,
  ): CommandScope | undefined {
    if (!interaction.channel) return undefined;
    if (interaction.channel.isDMBased()) {
      const policy = this.directMessagePolicy();
      if (!policy) return undefined;
      return {
        surface: { platform: "discord", kind: "dm", id: interaction.channelId },
        agentAliases: policy.agents,
        defaultAgent: policy.defaultAgent,
      };
    }
    const policy = this.threadPolicy(interaction.channel);
    if (policy && this.isEligibleThread(interaction.channel))
      return {
        surface: this.threadSurface(interaction.channel),
        agentAliases: policy.agents,
        defaultAgent: policy.defaultAgent,
      };
    return undefined;
  }

  private parentChannelPolicy(
    channel: ChatInputCommandInteraction["channel"],
  ): ChannelPolicy | undefined {
    if (!channel || channel.isDMBased() || channel.isThread()) return undefined;
    return this.runtimeConfig
      .snapshot()
      .config.discord?.channels.find((policy) => policy.id === channel.id);
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
      ? this.directMessagePolicy()
      : this.threadPolicy(message.channel);
    const surface = message.channel.isDMBased()
      ? this.surface(message)
      : policy && this.isEligibleThread(message.channel)
        ? this.threadSurface(message.channel)
        : undefined;
    if (!surface) return;

    if (!policy) {
      await message.reply(
        "A2A direct messages are disabled. Ask an operator to configure `directMessages`.",
      );
      return;
    }

    const content =
      surface.kind === "thread"
        ? this.threadMessageContent(message)
        : message.content.trim();
    if (!content) return;

    const contact = await this.selectedContact(surface, policy);
    if (!contact) {
      await message.reply(
        "No A2A agent is selected. Use `/a2a agent list` in Discord's command picker.",
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
    const group = interaction.options.getSubcommandGroup(true);
    const command = interaction.options.getSubcommand(true);
    const workspaceCommand = this.discordCommand(group, command, interaction);
    if (!workspaceCommand) {
      await interaction.reply("Invalid A2A command.");
      return;
    }

    const parentPolicy = this.parentChannelPolicy(interaction.channel);
    if (
      parentPolicy &&
      workspaceCommand.group === "session" &&
      workspaceCommand.action === "new"
    ) {
      await this.launchWorkspace(interaction, parentPolicy, workspaceCommand);
      return;
    }

    const scope = this.commandScope(interaction);
    if (!scope) {
      await interaction.reply(
        interaction.channel?.isDMBased()
          ? "A2A direct messages are disabled. Ask an operator to configure `directMessages`."
          : "Use this command in an allowlisted thread, or `/a2a session new` in an allowlisted channel.",
      );
      return;
    }
    const result = await this.workspaceCommands.execute(
      workspaceCommand,
      scope,
    );
    await interaction.reply(
      this.renderCommandResult(
        result,
        scope.surface,
        interaction.user.username,
      ),
    );
  }

  private discordCommand(
    group: string,
    action: string,
    interaction: ChatInputCommandInteraction,
  ): WorkspaceCommand | undefined {
    if (group === "agent") {
      if (action === "list" || action === "current") return { group, action };
      if (action === "use")
        return {
          group,
          action,
          agent: interaction.options.getString("agent", true),
        };
    }
    if (group === "session") {
      if (action === "new") {
        const values = [
          interaction.options.getString("agent"),
          interaction.options.getString("request"),
        ].filter((value): value is string => value !== null);
        return { group, action, arguments: values };
      }
      if (action === "current" || action === "list") return { group, action };
      if (action === "use")
        return {
          group,
          action,
          session: interaction.options.getString("session", true),
        };
    }
    if (group === "task") {
      if (action === "current" || action === "list") return { group, action };
      if (action === "status")
        return {
          group,
          action,
          task: interaction.options.getString("task", true),
        };
    }
    return undefined;
  }

  private async launchWorkspace(
    interaction: ChatInputCommandInteraction,
    policy: ChannelPolicy,
    command: Extract<WorkspaceCommand, { group: "session"; action: "new" }>,
  ): Promise<void> {
    const channel = interaction.channel;
    if (!channel || channel.isThread() || !("threads" in channel)) {
      await interaction.reply(
        "This channel cannot create an A2A workspace thread.",
      );
      return;
    }
    const thread = await channel.threads.create({
      name: "A2A workspace",
      autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
      reason: `A2A workspace requested by ${interaction.user.id}`,
    });
    const scope: CommandScope = {
      surface: this.threadSurface(thread),
      agentAliases: policy.agents,
      defaultAgent: policy.defaultAgent,
    };
    const result = await this.workspaceCommands.execute(command, scope);
    if (result.kind !== "session-new") {
      await interaction.reply(this.renderCommandResult(result, scope.surface));
      return;
    }
    await thread.send(
      `${this.workspaceIntro(result.agent, result.session)}\nWorkspace update: ${interaction.user.username} started this Session.`,
    );
    await interaction.reply(`Created ${thread} with **${result.agent.name}**.`);
    if (result.initialRequest)
      await this.sendWorkspaceRequest(
        thread,
        result.agent,
        result.session,
        result.initialRequest,
      );
  }

  private async sendWorkspaceRequest(
    channel: AnyThreadChannel,
    agent: Contact,
    session: Session,
    request: string,
  ): Promise<void> {
    let reply: Message | undefined;
    const sink: ReplySink = {
      publishInitial: async (text) => {
        reply = await channel.send(
          labelAgentReply(agent, text).slice(0, 2_000),
        );
      },
      update: async (text) => {
        if (reply)
          await reply.edit(labelAgentReply(agent, text).slice(0, 2_000));
      },
    };
    try {
      await this.connector.send(agent, session, request, sink);
    } catch (error) {
      await channel.send(`A2A request failed: ${(error as Error).message}`);
    }
  }

  private renderCommandResult(
    result: CommandResult,
    surface: Surface,
    actor?: string,
  ): string {
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
          ? `This ${this.surfaceLabel(surface)} is using **${result.agent.name}** (${this.aliasFor(result.agent) ?? result.agent.id}).\nAgent Card: <${result.agent.agentCardUrl}>`
          : "No A2A agent is selected. Run `/a2a agent list`, then `/a2a agent use <agent>`.";
      case "agent-selected":
        return `Selected **${result.agent.name}** (${this.aliasFor(result.agent) ?? result.agent.id}) for this ${this.surfaceLabel(surface)}.${actor ? `\nWorkspace update: ${actor} selected this agent.` : ""}`;
      case "session-new":
        return surface.kind === "thread"
          ? `${this.workspaceIntro(result.agent, result.session)}${actor ? `\nWorkspace update: ${actor} started this Session.` : ""}`
          : result.previous
            ? `Archived ${result.previous.id} and started ${result.session.id} with **${result.agent.name}**.`
            : `Started ${result.session.id} with **${result.agent.name}**.${actor ? `\nWorkspace update: ${actor} started this Session.` : ""}`;
      case "session-current":
        return result.session
          ? this.describeSession(result.session, true)
          : `No session has started with **${result.agent.name}**. Send a message to start one.`;
      case "session-list":
        return result.sessions.length
          ? result.sessions
              .map(
                (session) =>
                  `${session.id === result.active?.id ? "• **active**" : "•"} ${this.describeSession(session, false)}`,
              )
              .join("\n")
          : `No saved sessions for this A2A agent in this ${this.surfaceLabel(surface)}.`;
      case "session-selected":
        return `Resumed ${result.session.id} with **${result.agent.name}**.${actor ? `\nWorkspace update: ${actor} resumed this Session.` : ""}`;
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

  private async selectedContact(
    surface: Surface,
    policy?: Pick<ChannelPolicy, "agents" | "defaultAgent">,
  ): Promise<Contact | undefined> {
    return this.workspaceCommands.selectedAgent({
      surface,
      agentAliases: policy?.agents,
      defaultAgent: policy?.defaultAgent,
    });
  }

  private surfaceLabel(surface: Surface): string {
    return surface.kind === "dm"
      ? "DM"
      : surface.kind === "group-dm"
        ? "group DM"
        : "thread";
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
    policy?: Pick<ChannelPolicy, "agents" | "defaultAgent">,
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

  private async availableContacts(
    policy?: Pick<ChannelPolicy, "agents" | "defaultAgent">,
  ): Promise<Contact[]> {
    return [
      ...(await this.workspaceCommands.availableAgents({
        surface: { platform: "discord", kind: "dm", id: "availability" },
        agentAliases: policy?.agents,
        defaultAgent: policy?.defaultAgent,
      })),
    ];
  }

  private async availableContact(
    id: string,
    policy?: Pick<ChannelPolicy, "agents" | "defaultAgent">,
  ): Promise<Contact | undefined> {
    return this.workspaceCommands.availableAgent(id, {
      surface: { platform: "discord", kind: "dm", id: "availability" },
      agentAliases: policy?.agents,
      defaultAgent: policy?.defaultAgent,
    });
  }

  private aliasFor(contact: Contact): string | undefined {
    return this.runtimeConfig
      .snapshot()
      .config.agents.find(
        (agent) => agent.agentCardUrl === contact.agentCardUrl,
      )?.alias;
  }
}
