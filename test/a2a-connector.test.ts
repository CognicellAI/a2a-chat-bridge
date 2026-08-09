import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import { A2AConnector } from "../src/core/a2a-connector.js";
import type { Contact, Session } from "../src/domain.js";
import { MemoryStateStore } from "./fakes.js";

const contact: Contact = {
  id: "agent",
  agentCardUrl: "https://agent.example",
  name: "Agent",
  description: "",
  supportsStreaming: false,
  createdAt: "now",
};
const session: Session = {
  id: "session-1",
  contactId: "agent",
  surface: { platform: "discord", kind: "dm", id: "dm-1" },
  createdAt: "now",
  updatedAt: "now",
};

const config: Config = {
  discord: { tokenEnv: "DISCORD_BOT_TOKEN", channels: [] },
  stateFile: "state.json",
  editIntervalMs: 1_200,
  pollIntervalMs: 1_500,
  configReloadIntervalMs: 2_000,
  managesContacts: true,
  agents: [],
};

describe("A2A connector", () => {
  it("uses non-blocking send then polls until terminal, persisting context", async () => {
    const state = new MemoryStateStore();
    const updates: string[] = [];
    let polls = 0;
    const client = {
      protocolVersion: "1.0",
      sendMessage: async () => ({
        id: "task-1",
        contextId: "context-1",
        status: { state: 2 },
        artifacts: [],
        history: [],
      }),
      getTask: async () => {
        polls += 1;
        return {
          id: "task-1",
          contextId: "context-1",
          status: {
            state: 3,
            message: {
              parts: [{ content: { $case: "text", value: "final answer" } }],
            },
          },
          artifacts: [],
          history: [],
        };
      },
    };
    const connector = new A2AConnector(state, {
      runtimeConfig: { snapshot: () => ({ revision: 1, config }) },
      pollIntervalMs: 0,
      editIntervalMs: 60_000,
      clientFactory: async () => client as never,
    });
    const result = await connector.send(contact, session, "hello", {
      publishInitial: async () => undefined,
      update: async (text) => {
        updates.push(text);
      },
    });
    expect(polls).toBe(1);
    expect(result.contextId).toBe("context-1");
    expect(updates).toEqual(["final answer"]);
    expect(await state.listInFlightTasks()).toEqual([]);
    expect((await state.getTaskRecord("task-1"))?.state).toBe(
      "TASK_STATE_COMPLETED",
    );
  });

  it("reports unsupported task resubscription without publishing a placeholder", async () => {
    const state = new MemoryStateStore();
    state.contacts.set(contact.id, contact);
    await state.saveInFlightTask({
      taskId: "task-recovery",
      sessionId: session.id,
      contactId: contact.id,
      surface: session.surface,
    });
    await state.saveTaskRecord({
      taskId: "task-recovery",
      sessionId: session.id,
      contactId: contact.id,
      surface: session.surface,
      state: "TASK_STATE_WORKING",
      createdAt: "now",
      updatedAt: "now",
    });
    const connector = new A2AConnector(state, {
      runtimeConfig: { snapshot: () => ({ revision: 1, config }) },
      pollIntervalMs: 0,
      editIntervalMs: 60_000,
      clientFactory: async () =>
        ({
          protocolVersion: "1.0",
          resubscribeTask: async function* () {
            throw {
              name: "UnsupportedOperationError",
              reason: "UNSUPPORTED_OPERATION",
              envelopeCode: -32_004,
            };
          },
        }) as never,
    });
    let published = 0;

    const unavailable = await connector.recover(() => ({
      publishInitial: async () => {
        published += 1;
      },
      update: async () => undefined,
    }));
    expect(published).toBe(0);
    expect(unavailable).toEqual([{ contact, task: expect.any(Object) }]);
    expect(await state.listInFlightTasks()).toEqual([]);
    expect(await state.getTaskRecord("task-recovery")).toEqual(
      expect.objectContaining({ state: "TASK_STATE_WORKING" }),
    );
  });
});
