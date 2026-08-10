import type { A2AConnector } from "./a2a-connector.js";
import type { RuntimeConfig } from "./runtime-config.js";
import type { StateStore } from "./ports.js";
import type { Contact, Session, Surface, TaskRecord } from "../domain.js";
import { surfaceKey } from "../domain.js";

export type WorkspaceCommand =
  | { readonly group: "agent"; readonly action: "list" | "current" }
  | { readonly group: "agent"; readonly action: "use"; readonly agent: string }
  | {
      readonly group: "session";
      readonly action: "new";
      readonly arguments: readonly string[];
    }
  | { readonly group: "session"; readonly action: "current" | "list" }
  | {
      readonly group: "session";
      readonly action: "use";
      readonly session: string;
    }
  | { readonly group: "task"; readonly action: "current" | "list" }
  | {
      readonly group: "task";
      readonly action: "status";
      readonly task: string;
    };

export interface CommandScope {
  readonly surface: Surface;
  readonly agentAliases?: readonly string[];
  readonly defaultAgent?: string;
}

export type CommandResult =
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "agent-list"; readonly agents: readonly Contact[] }
  | { readonly kind: "agent-current"; readonly agent?: Contact }
  | { readonly kind: "agent-selected"; readonly agent: Contact }
  | {
      readonly kind: "session-new";
      readonly agent: Contact;
      readonly session: Session;
      readonly previous?: Session;
      readonly initialRequest?: string;
    }
  | {
      readonly kind: "session-current";
      readonly agent: Contact;
      readonly session?: Session;
    }
  | {
      readonly kind: "session-list";
      readonly agent: Contact;
      readonly sessions: readonly Session[];
      readonly active?: Session;
    }
  | {
      readonly kind: "session-selected";
      readonly agent: Contact;
      readonly session: Session;
    }
  | {
      readonly kind: "task-list";
      readonly session: Session;
      readonly tasks: readonly TaskRecord[];
    }
  | {
      readonly kind: "task-current";
      readonly task?: TaskRecord;
      readonly session: Session;
    }
  | {
      readonly kind: "task-status";
      readonly task: TaskRecord;
      readonly refreshError?: string;
    };

export const parseWorkspaceCommand = (
  text: string,
): WorkspaceCommand | undefined => {
  const parts = text
    .replace(/^\/a2a\s*/i, "")
    .trim()
    .split(/\s+/);
  const [group, action, argument, ...rest] = parts;
  if (!group || !action) return undefined;
  if (group === "agent") {
    if (action === "list" || action === "current") return { group, action };
    if (action === "use" && argument) return { group, action, agent: argument };
    return undefined;
  }
  if (group === "session") {
    if (action === "new")
      return { group, action, arguments: [argument, ...rest].filter(Boolean) };
    if (action === "current" || action === "list") return { group, action };
    if (action === "use" && argument)
      return { group, action, session: argument };
    return undefined;
  }
  if (group === "task") {
    if (action === "current" || action === "list") return { group, action };
    if (action === "status" && argument)
      return { group, action, task: argument };
  }
  return undefined;
};

export const commandHelp =
  "Commands: `/a2a agent list|current|use <agent>`, `/a2a session new [agent] [request]|current|list|use <session>`, `/a2a task current|list|status <task>`.";

export class WorkspaceCommands {
  private readonly selectedAgentBySurface = new Map<string, string>();

  public constructor(
    private readonly state: StateStore,
    private readonly connector: A2AConnector,
    private readonly runtimeConfig: RuntimeConfig,
  ) {}

  async execute(
    command: WorkspaceCommand,
    scope: CommandScope,
  ): Promise<CommandResult> {
    if (command.group === "agent") return this.executeAgent(command, scope);
    if (command.group === "session") return this.executeSession(command, scope);
    return this.executeTask(command, scope);
  }

  async selectedAgent(scope: CommandScope): Promise<Contact | undefined> {
    const selected = this.selectedAgentBySurface.get(surfaceKey(scope.surface));
    if (selected) return this.availableAgent(selected, scope);
    if (scope.defaultAgent)
      return this.availableAgent(scope.defaultAgent, scope);
    const aliases = scope.agentAliases;
    if (aliases?.length === 1) return this.availableAgent(aliases[0], scope);
    const available = await this.availableAgents(scope);
    if (available.length === 1) return available[0];
    return undefined;
  }

  async availableAgents(scope: CommandScope): Promise<readonly Contact[]> {
    const contacts = await this.state.listContacts();
    const config = this.runtimeConfig.snapshot().config;
    const configured = config.managesContacts
      ? contacts.filter((contact) =>
          config.agents.some(
            (agent) => agent.agentCardUrl === contact.agentCardUrl,
          ),
        )
      : contacts;
    return scope.agentAliases
      ? configured.filter((contact) =>
          scope.agentAliases?.includes(this.aliasFor(contact) ?? ""),
        )
      : configured;
  }

  async availableAgent(
    identifier: string,
    scope: CommandScope,
  ): Promise<Contact | undefined> {
    return (await this.availableAgents(scope)).find(
      (contact) =>
        contact.id === identifier || this.aliasFor(contact) === identifier,
    );
  }

  aliasFor(contact: Contact): string | undefined {
    return this.runtimeConfig
      .snapshot()
      .config.agents.find(
        (agent) => agent.agentCardUrl === contact.agentCardUrl,
      )?.alias;
  }

  private async executeAgent(
    command: Extract<WorkspaceCommand, { group: "agent" }>,
    scope: CommandScope,
  ): Promise<CommandResult> {
    if (command.action === "list")
      return { kind: "agent-list", agents: await this.availableAgents(scope) };
    if (command.action === "current")
      return { kind: "agent-current", agent: await this.selectedAgent(scope) };
    const agent = await this.availableAgent(
      (command as Extract<WorkspaceCommand, { group: "agent"; action: "use" }>)
        .agent,
      scope,
    );
    if (!agent)
      return {
        kind: "error",
        message: `Unknown A2A agent ${(command as Extract<WorkspaceCommand, { group: "agent"; action: "use" }>).agent}. Run \`/a2a agent list\`.`,
      };
    this.selectedAgentBySurface.set(surfaceKey(scope.surface), agent.id);
    return { kind: "agent-selected", agent };
  }

  private async executeSession(
    command: Extract<WorkspaceCommand, { group: "session" }>,
    scope: CommandScope,
  ): Promise<CommandResult> {
    if (command.action === "new") {
      const { agent, initialRequest } = await this.resolveNewSessionAgent(
        command.arguments,
        scope,
      );
      if (!agent)
        return {
          kind: "error",
          message:
            "No A2A agent is selected. Run `/a2a agent list`, then `/a2a agent use <agent>`.",
        };
      const previous = await this.state.getActiveSession(
        agent.id,
        scope.surface,
      );
      const session = await this.createSession(agent, scope.surface);
      return { kind: "session-new", agent, session, previous, initialRequest };
    }
    const agent = await this.selectedAgent(scope);
    if (!agent)
      return {
        kind: "error",
        message: `No A2A agent is selected for this ${surfaceLabel(scope.surface)}.`,
      };
    if (command.action === "current")
      return {
        kind: "session-current",
        agent,
        session: await this.state.getActiveSession(agent.id, scope.surface),
      };
    if (command.action === "list") {
      const [sessions, active] = await Promise.all([
        this.state.listSessions(agent.id, scope.surface),
        this.state.getActiveSession(agent.id, scope.surface),
      ]);
      return { kind: "session-list", agent, sessions, active };
    }
    const session = await this.state.getSession(
      (
        command as Extract<
          WorkspaceCommand,
          { group: "session"; action: "use" }
        >
      ).session,
    );
    if (
      !session ||
      session.contactId !== agent.id ||
      surfaceKey(session.surface) !== surfaceKey(scope.surface)
    )
      return {
        kind: "error",
        message: `Unknown session ${(command as Extract<WorkspaceCommand, { group: "session"; action: "use" }>).session}. Run \`/a2a session list\`.`,
      };
    await this.state.selectSession(agent.id, scope.surface, session.id);
    return { kind: "session-selected", agent, session };
  }

  private async executeTask(
    command: Extract<WorkspaceCommand, { group: "task" }>,
    scope: CommandScope,
  ): Promise<CommandResult> {
    const agent = await this.selectedAgent(scope);
    if (!agent)
      return {
        kind: "error",
        message: `No A2A agent is selected for this ${surfaceLabel(scope.surface)}.`,
      };
    const session = await this.state.getActiveSession(agent.id, scope.surface);
    if (!session)
      return {
        kind: "error",
        message: `No session has started with ${agent.name}. Send a message to start one.`,
      };
    if (command.action === "list")
      return {
        kind: "task-list",
        session,
        tasks: await this.state.listTaskRecords(session.id),
      };
    const task =
      command.action === "current"
        ? (await this.state.listTaskRecords(session.id))[0]
        : await this.state.getTaskRecord(
            (
              command as Extract<
                WorkspaceCommand,
                { group: "task"; action: "status" }
              >
            ).task,
          );
    if (
      !task ||
      task.contactId !== agent.id ||
      surfaceKey(task.surface) !== surfaceKey(scope.surface)
    )
      return { kind: "error", message: "Unknown Task. Run `/a2a task list`." };
    try {
      return {
        kind: "task-status",
        task: await this.connector.inspectTask(agent, task),
      };
    } catch (error) {
      return {
        kind: "task-status",
        task,
        refreshError: (error as Error).message,
      };
    }
  }

  private async resolveNewSessionAgent(
    arguments_: readonly string[],
    scope: CommandScope,
  ): Promise<{ agent?: Contact; initialRequest?: string }> {
    if (!arguments_.length) return { agent: await this.selectedAgent(scope) };
    const candidate = await this.availableAgent(arguments_[0], scope);
    if (candidate) {
      this.selectedAgentBySurface.set(surfaceKey(scope.surface), candidate.id);
      return {
        agent: candidate,
        initialRequest: arguments_.slice(1).join(" ") || undefined,
      };
    }
    return {
      agent: await this.selectedAgent(scope),
      initialRequest: arguments_.join(" "),
    };
  }

  private async createSession(
    agent: Contact,
    surface: Surface,
  ): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: `session-${crypto.randomUUID().slice(0, 8)}`,
      contactId: agent.id,
      surface,
      createdAt: now,
      updatedAt: now,
    };
    await this.state.saveSession(session);
    await this.state.selectSession(agent.id, surface, session.id);
    return session;
  }
}

export const surfaceLabel = (surface: Surface): string =>
  surface.kind === "dm"
    ? "DM"
    : surface.kind === "group-dm"
      ? "group DM"
      : "thread";
