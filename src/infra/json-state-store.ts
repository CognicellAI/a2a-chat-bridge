import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  Contact,
  InFlightTask,
  Session,
  Surface,
  TaskRecord,
} from "../domain.js";
import { surfaceKey } from "../domain.js";
import type { StateStore } from "../core/ports.js";

interface PersistedState {
  contacts: Record<string, Contact>;
  /** Retained only long enough to migrate pre-session state files. */
  conversations?: Record<
    string,
    Omit<Session, "id" | "createdAt"> & { createdAt?: string }
  >;
  sessions: Record<string, Session>;
  activeSessions: Record<string, string>;
  taskRecords: Record<string, TaskRecord>;
  inFlightTasks: Record<string, InFlightTask>;
}
const blank = (): PersistedState => ({
  contacts: {},
  sessions: {},
  activeSessions: {},
  taskRecords: {},
  inFlightTasks: {},
});

/** Node/Bun infrastructure; intentionally not imported by the portable core. */
export class JsonStateStore implements StateStore {
  private loaded?: PersistedState;
  public constructor(private readonly file: string) {}
  private async data(): Promise<PersistedState> {
    if (this.loaded) return this.loaded;
    try {
      this.loaded = JSON.parse(
        await readFile(this.file, "utf8"),
      ) as PersistedState;
      this.migrate(this.loaded);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.loaded = blank();
    }
    return this.loaded;
  }
  private migrate(state: PersistedState): void {
    state.sessions ??= {};
    state.activeSessions ??= {};
    state.taskRecords ??= {};
    state.inFlightTasks ??= {};
    state.contacts ??= {};
    for (const [key, conversation] of Object.entries(
      state.conversations ?? {},
    )) {
      if (state.activeSessions[key]) continue;
      const id = `session-legacy-${Object.keys(state.sessions).length + 1}`;
      state.sessions[id] = {
        id,
        contactId: conversation.contactId,
        surface: conversation.surface,
        contextId: conversation.contextId,
        createdAt: conversation.createdAt ?? conversation.updatedAt,
        updatedAt: conversation.updatedAt,
      };
      state.activeSessions[key] = id;
    }
    delete state.conversations;
  }
  private async persist(): Promise<void> {
    const state = await this.data();
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2));
    await rename(temporary, this.file);
  }
  async listContacts() {
    return Object.values((await this.data()).contacts);
  }
  async getContact(id: string) {
    return (await this.data()).contacts[id];
  }
  async saveContact(contact: Contact) {
    (await this.data()).contacts[contact.id] = contact;
    await this.persist();
  }
  async getActiveSession(contactId: string, surface: Surface) {
    const state = await this.data();
    return state.sessions[
      state.activeSessions[`${contactId}:${surfaceKey(surface)}`]
    ];
  }
  async getSession(id: string) {
    return (await this.data()).sessions[id];
  }
  async listSessions(contactId: string, surface: Surface) {
    return Object.values((await this.data()).sessions)
      .filter(
        (session) =>
          session.contactId === contactId &&
          surfaceKey(session.surface) === surfaceKey(surface),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  async saveSession(session: Session) {
    (await this.data()).sessions[session.id] = session;
    await this.persist();
  }
  async selectSession(contactId: string, surface: Surface, sessionId: string) {
    const state = await this.data();
    const session = state.sessions[sessionId];
    if (
      !session ||
      session.contactId !== contactId ||
      surfaceKey(session.surface) !== surfaceKey(surface)
    )
      throw new Error(
        "Session does not belong to this Contact and chat surface.",
      );
    state.activeSessions[`${contactId}:${surfaceKey(surface)}`] = sessionId;
    await this.persist();
  }
  async clearActiveSession(contactId: string, surface: Surface) {
    delete (await this.data()).activeSessions[
      `${contactId}:${surfaceKey(surface)}`
    ];
    await this.persist();
  }
  async getTaskRecord(taskId: string) {
    return (await this.data()).taskRecords[taskId];
  }
  async listTaskRecords(sessionId: string) {
    return Object.values((await this.data()).taskRecords)
      .filter((task) => task.sessionId === sessionId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  async saveTaskRecord(task: TaskRecord) {
    (await this.data()).taskRecords[task.taskId] = task;
    await this.persist();
  }
  async listInFlightTasks() {
    return Object.values((await this.data()).inFlightTasks);
  }
  async saveInFlightTask(task: InFlightTask) {
    (await this.data()).inFlightTasks[task.taskId] = task;
    await this.persist();
  }
  async removeInFlightTask(taskId: string) {
    delete (await this.data()).inFlightTasks[taskId];
    await this.persist();
  }
}
