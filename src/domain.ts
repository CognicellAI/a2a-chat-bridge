/** Platform-independent ubiquitous language. */
export interface Contact {
  id: string;
  agentCardUrl: string;
  name: string;
  description: string;
  supportsStreaming: boolean;
  createdAt: string;
}

export interface Surface {
  platform: "discord";
  kind: "dm" | "thread";
  id: string;
}

export interface Session {
  /** Bridge-owned, friendly identifier used by chat controls. */
  id: string;
  contactId: string;
  surface: Surface;
  /** Opaque remote A2A identifier; assigned by the server after the first send. */
  contextId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InFlightTask {
  taskId: string;
  sessionId: string;
  contactId: string;
  surface: Surface;
  contextId?: string;
}

/** Local metadata about a Task initiated by this bridge; remote state is authoritative. */
export interface TaskRecord {
  taskId: string;
  sessionId: string;
  contactId: string;
  surface: Surface;
  contextId?: string;
  state: string;
  createdAt: string;
  updatedAt: string;
}

export const surfaceKey = (surface: Surface): string =>
  `${surface.platform}:${surface.kind}:${surface.id}`;
