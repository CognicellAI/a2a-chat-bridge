import { ClientFactory, type Client } from "@a2a-js/sdk/client";
import {
  Role,
  TaskState,
  type Message,
  type SendMessageRequest,
  type Task,
} from "@a2a-js/sdk";
import type { Contact, InFlightTask, Session, TaskRecord } from "../domain.js";
import type { RuntimeConfigSnapshot } from "./runtime-config.js";
import { EditScheduler } from "./edit-scheduler.js";
import { M2MTokenProvider } from "./m2m-token-provider.js";
import type { ReplySink, StateStore } from "./ports.js";
import {
  taskFromStreamResponse,
  textFromMessage,
  textFromStreamResponse,
  textFromTask,
} from "./stream.js";

export interface ConnectorOptions {
  runtimeConfig: { snapshot(): RuntimeConfigSnapshot };
  pollIntervalMs: number;
  editIntervalMs: number;
  tokenProvider?: M2MTokenProvider;
  clientFactory?: (contact: Contact) => Promise<Client>;
}

export interface TaskRecoveryUnavailable {
  readonly contact: Contact;
  readonly task: InFlightTask;
}

const terminalStates = new Set<TaskState>([
  TaskState.TASK_STATE_COMPLETED,
  TaskState.TASK_STATE_FAILED,
  TaskState.TASK_STATE_CANCELED,
  TaskState.TASK_STATE_REJECTED,
  TaskState.TASK_STATE_INPUT_REQUIRED,
  TaskState.TASK_STATE_AUTH_REQUIRED,
]);

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Task resubscription is optional in A2A. The SDK preserves this semantic
 * error across transports, but its concrete class is transport-specific.
 */
const isUnsupportedTaskResubscription = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: unknown;
    reason?: unknown;
    envelopeCode?: unknown;
  };
  return (
    candidate.name === "UnsupportedOperationError" ||
    candidate.reason === "UNSUPPORTED_OPERATION" ||
    candidate.envelopeCode === -32_004
  );
};

export class A2AConnector {
  private readonly tokenProvider: M2MTokenProvider;
  public constructor(
    private readonly state: StateStore,
    private readonly options: ConnectorOptions,
  ) {
    this.tokenProvider = options.tokenProvider ?? new M2MTokenProvider();
  }

  private async clientFor(contact: Contact): Promise<Client> {
    if (this.options.clientFactory) return this.options.clientFactory(contact);
    const client = await new ClientFactory().createFromUrl(
      contact.agentCardUrl,
      "",
    );
    if (client.protocolVersion !== "1.0")
      throw new Error("The Contact does not expose A2A v1.0.");
    return client;
  }

  private request(text: string, session: Session): SendMessageRequest {
    const message: Message = {
      messageId: crypto.randomUUID(),
      contextId: session.contextId ?? "",
      taskId: "",
      role: Role.ROLE_USER,
      parts: [
        {
          content: { $case: "text", value: text },
          metadata: undefined,
          filename: "",
          mediaType: "text/plain",
        },
      ],
      metadata: undefined,
      extensions: [],
      referenceTaskIds: [],
    };
    return {
      tenant: "",
      message,
      configuration: {
        acceptedOutputModes: ["text/plain"],
        taskPushNotificationConfig: undefined,
        returnImmediately: true,
      },
      metadata: undefined,
    };
  }

  private async headers(contact: Contact, snapshot: RuntimeConfigSnapshot) {
    const agent = snapshot.config.agents.find(
      (configured) => configured.agentCardUrl === contact.agentCardUrl,
    );
    if (agent?.auth?.type === "oauth-client-credentials") {
      return {
        serviceParameters: {
          Authorization: await this.tokenProvider.authorization(
            `${snapshot.revision}:${contact.agentCardUrl}`,
            agent.auth,
          ),
        },
      };
    }
    if (agent?.auth?.type === "static-headers")
      return { serviceParameters: agent.auth.headers };
    return {
      serviceParameters: {},
    };
  }

  private async rememberTask(
    task: Task,
    contact: Contact,
    session: Session,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.state.saveInFlightTask({
      taskId: task.id,
      sessionId: session.id,
      contactId: contact.id,
      surface: session.surface,
      contextId: task.contextId,
    });
    const previous = await this.state.getTaskRecord(task.id);
    await this.state.saveTaskRecord({
      taskId: task.id,
      sessionId: session.id,
      contactId: contact.id,
      surface: session.surface,
      contextId: task.contextId,
      state: task.status ? TaskState[task.status.state] : "TASK_STATE_UNKNOWN",
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async send(
    contact: Contact,
    session: Session,
    text: string,
    sink: ReplySink,
  ): Promise<Session> {
    const snapshot = this.options.runtimeConfig.snapshot();
    const client = await this.clientFor(contact);
    const scheduler = new EditScheduler(sink, this.options.editIntervalMs);
    await sink.publishInitial("…");
    const request = this.request(text, session);
    let contextId = session.contextId;

    if (contact.supportsStreaming) {
      for await (const response of client.sendMessageStream(
        request,
        await this.headers(contact, snapshot),
      )) {
        const task = taskFromStreamResponse(response);
        if (task) {
          contextId = task.contextId || contextId;
          await this.rememberTask(task, contact, session);
          if (task.status && terminalStates.has(task.status.state)) {
            await this.state.removeInFlightTask(task.id);
          }
        }
        scheduler.append(textFromStreamResponse(response));
      }
    } else {
      const result = await client.sendMessage(
        request,
        await this.headers(contact, snapshot),
      );
      if ("status" in result) {
        contextId = result.contextId || contextId;
        await this.rememberTask(result, contact, session);
        const completed = await this.pollTask(
          client,
          result,
          contact,
          session,
          snapshot,
          scheduler,
        );
        contextId = completed.contextId || contextId;
      } else {
        contextId = result.contextId || contextId;
        scheduler.append(textFromMessage(result));
      }
    }
    await scheduler.flush();
    const updated = {
      ...session,
      contextId,
      updatedAt: new Date().toISOString(),
    };
    await this.state.saveSession(updated);
    return updated;
  }

  private async pollTask(
    client: Client,
    task: Task,
    contact: Contact,
    session: Session,
    snapshot: RuntimeConfigSnapshot,
    scheduler: EditScheduler,
  ): Promise<Task> {
    let current = task;
    while (!current.status || !terminalStates.has(current.status.state)) {
      await pause(this.options.pollIntervalMs);
      current = await client.getTask(
        { tenant: "", id: current.id },
        await this.headers(contact, snapshot),
      );
      await this.rememberTask(current, contact, session);
      scheduler.append(textFromTask(current));
    }
    await this.state.removeInFlightTask(current.id);
    return current;
  }

  async inspectTask(contact: Contact, record: TaskRecord): Promise<TaskRecord> {
    const snapshot = this.options.runtimeConfig.snapshot();
    const client = await this.clientFor(contact);
    const task = await client.getTask(
      { tenant: "", id: record.taskId },
      await this.headers(contact, snapshot),
    );
    const updated: TaskRecord = {
      ...record,
      contextId: task.contextId || record.contextId,
      state: task.status ? TaskState[task.status.state] : "TASK_STATE_UNKNOWN",
      updatedAt: new Date().toISOString(),
    };
    await this.state.saveTaskRecord(updated);
    if (task.status && terminalStates.has(task.status.state))
      await this.state.removeInFlightTask(task.id);
    return updated;
  }

  /** Best-effort recovery: authoritative task state stays on the remote A2A server. */
  async recover(
    sinkFor: (task: InFlightTask) => ReplySink | undefined,
  ): Promise<readonly TaskRecoveryUnavailable[]> {
    const unavailable: TaskRecoveryUnavailable[] = [];
    for (const inFlight of await this.state.listInFlightTasks()) {
      const contact = await this.state.getContact(inFlight.contactId);
      const sink = sinkFor(inFlight);
      if (!contact || !sink) continue;
      const client = await this.clientFor(contact);
      const snapshot = this.options.runtimeConfig.snapshot();
      const scheduler = new EditScheduler(sink, this.options.editIntervalMs);
      try {
        for await (const response of client.resubscribeTask(
          { tenant: "", id: inFlight.taskId },
          await this.headers(contact, snapshot),
        )) {
          scheduler.append(textFromStreamResponse(response));
        }
      } catch (error: unknown) {
        if (!isUnsupportedTaskResubscription(error)) throw error;
        unavailable.push({ contact, task: inFlight });
        // The task remains inspectable through its TaskRecord, but retrying an
        // optional operation this agent cannot perform would create log noise
        // on every bridge restart.
        await this.state.removeInFlightTask(inFlight.taskId);
        continue;
      }
      await scheduler.flush();
      await this.state.removeInFlightTask(inFlight.taskId);
    }
    return unavailable;
  }
}
