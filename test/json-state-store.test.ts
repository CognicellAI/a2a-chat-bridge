import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonStateStore } from "../src/infra/json-state-store.js";

let directory = "";
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe("JSON soft state", () => {
  it("persists the active Session and its Task records across store instances", async () => {
    directory = await mkdtemp(join(tmpdir(), "a2a-chat-bridge-"));
    const file = join(directory, "state.json");
    const surface = {
      platform: "discord" as const,
      kind: "dm" as const,
      id: "dm",
    };
    const first = new JsonStateStore(file);
    await first.saveContact({
      id: "a",
      agentCardUrl: "https://a.example",
      name: "A",
      description: "",
      supportsStreaming: true,
      createdAt: "now",
    });
    await first.saveSession({
      id: "session-1",
      contactId: "a",
      surface,
      contextId: "ctx",
      createdAt: "then",
      updatedAt: "now",
    });
    await first.selectSession("a", surface, "session-1");
    await first.saveTaskRecord({
      taskId: "task-1",
      sessionId: "session-1",
      contactId: "a",
      surface,
      contextId: "ctx",
      state: "TASK_STATE_COMPLETED",
      createdAt: "then",
      updatedAt: "now",
    });
    const second = new JsonStateStore(file);
    expect((await second.getActiveSession("a", surface))?.contextId).toBe(
      "ctx",
    );
    expect(await second.listTaskRecords("session-1")).toHaveLength(1);
    expect((await second.getContact("a"))?.name).toBe("A");
  });

  it("archives a Session by clearing only its active selection", async () => {
    directory = await mkdtemp(join(tmpdir(), "a2a-chat-bridge-"));
    const file = join(directory, "state.json");
    const surface = {
      platform: "discord" as const,
      kind: "dm" as const,
      id: "dm",
    };
    const store = new JsonStateStore(file);
    await store.saveContact({
      id: "a",
      agentCardUrl: "https://a.example",
      name: "A",
      description: "",
      supportsStreaming: true,
      createdAt: "now",
    });
    await store.saveSession({
      id: "session-1",
      contactId: "a",
      surface,
      contextId: "ctx",
      createdAt: "then",
      updatedAt: "now",
    });
    await store.selectSession("a", surface, "session-1");

    await store.clearActiveSession("a", surface);

    expect(await store.getActiveSession("a", surface)).toBeUndefined();
    expect((await store.getSession("session-1"))?.contextId).toBe("ctx");
    expect((await store.getContact("a"))?.name).toBe("A");
  });
});
