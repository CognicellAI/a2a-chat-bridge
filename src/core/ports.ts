import type {
  Contact,
  InFlightTask,
  Session,
  Surface,
  TaskRecord,
} from "../domain.js";

export interface StateStore {
  listContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  saveContact(contact: Contact): Promise<void>;
  getActiveSession(
    contactId: string,
    surface: Surface,
  ): Promise<Session | undefined>;
  getSession(id: string): Promise<Session | undefined>;
  listSessions(contactId: string, surface: Surface): Promise<Session[]>;
  saveSession(session: Session): Promise<void>;
  selectSession(
    contactId: string,
    surface: Surface,
    sessionId: string,
  ): Promise<void>;
  clearActiveSession(contactId: string, surface: Surface): Promise<void>;
  getTaskRecord(taskId: string): Promise<TaskRecord | undefined>;
  listTaskRecords(sessionId: string): Promise<TaskRecord[]>;
  saveTaskRecord(task: TaskRecord): Promise<void>;
  listInFlightTasks(): Promise<InFlightTask[]>;
  saveInFlightTask(task: InFlightTask): Promise<void>;
  removeInFlightTask(taskId: string): Promise<void>;
}

export interface ReplySink {
  publishInitial(text: string): Promise<void>;
  update(text: string): Promise<void>;
}
