import type {
  Contact,
  InFlightTask,
  Session,
  Surface,
  TaskRecord,
} from "../src/domain.js";
import type { StateStore } from "../src/core/ports.js";
import { surfaceKey } from "../src/domain.js";

export class MemoryStateStore implements StateStore {
  contacts = new Map<string, Contact>();
  sessions = new Map<string, Session>();
  activeSessions = new Map<string, string>();
  taskRecords = new Map<string, TaskRecord>();
  tasks = new Map<string, InFlightTask>();
  listContacts = async () => [...this.contacts.values()];
  getContact = async (id: string) => this.contacts.get(id);
  saveContact = async (contact: Contact) => {
    this.contacts.set(contact.id, contact);
  };
  getActiveSession = async (contactId: string, surface: Surface) =>
    this.sessions.get(
      this.activeSessions.get(`${contactId}:${surfaceKey(surface)}`) ?? "",
    );
  getSession = async (id: string) => this.sessions.get(id);
  listSessions = async (contactId: string, surface: Surface) =>
    [...this.sessions.values()].filter(
      (session) =>
        session.contactId === contactId &&
        surfaceKey(session.surface) === surfaceKey(surface),
    );
  saveSession = async (session: Session) => {
    this.sessions.set(session.id, session);
  };
  selectSession = async (
    contactId: string,
    surface: Surface,
    sessionId: string,
  ) => {
    const session = this.sessions.get(sessionId);
    if (
      !session ||
      session.contactId !== contactId ||
      surfaceKey(session.surface) !== surfaceKey(surface)
    )
      throw new Error(
        "Session does not belong to this Contact and chat surface.",
      );
    this.activeSessions.set(`${contactId}:${surfaceKey(surface)}`, sessionId);
  };
  clearActiveSession = async (contactId: string, surface: Surface) => {
    this.activeSessions.delete(`${contactId}:${surfaceKey(surface)}`);
  };
  getTaskRecord = async (taskId: string) => this.taskRecords.get(taskId);
  listTaskRecords = async (sessionId: string) =>
    [...this.taskRecords.values()].filter(
      (task) => task.sessionId === sessionId,
    );
  saveTaskRecord = async (task: TaskRecord) => {
    this.taskRecords.set(task.taskId, task);
  };
  listInFlightTasks = async () => [...this.tasks.values()];
  saveInFlightTask = async (task: InFlightTask) => {
    this.tasks.set(task.taskId, task);
  };
  removeInFlightTask = async (taskId: string) => {
    this.tasks.delete(taskId);
  };
}
