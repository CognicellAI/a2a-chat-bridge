import { describe, expect, it } from "vitest";
import type { A2AConnector } from "../src/core/a2a-connector.js";
import type { RuntimeConfig } from "../src/core/runtime-config.js";
import {
  parseWorkspaceCommand,
  WorkspaceCommands,
} from "../src/core/workspace-commands.js";
import type { Surface } from "../src/domain.js";
import { MemoryStateStore } from "./fakes.js";

const surface: Surface = {
  platform: "discord",
  kind: "thread",
  id: "thread-1",
};

const runtimeConfig = {
  snapshot: () => ({
    revision: 1,
    config: {
      stateFile: "state.json",
      agents: [
        { alias: "concierge", agentCardUrl: "https://concierge.example/card" },
        { alias: "researcher", agentCardUrl: "https://research.example/card" },
      ],
      managesContacts: true,
    },
  }),
} as unknown as RuntimeConfig;

const commandCases = [
  ["/a2a agent list", { group: "agent", action: "list" }],
  [
    "/a2a agent use concierge",
    { group: "agent", action: "use", agent: "concierge" },
  ],
  [
    "/a2a session new concierge hello",
    { group: "session", action: "new", arguments: ["concierge", "hello"] },
  ],
  ["/a2a session current", { group: "session", action: "current" }],
  [
    "/a2a session use session-1",
    { group: "session", action: "use", session: "session-1" },
  ],
  [
    "/a2a task status task-1",
    { group: "task", action: "status", task: "task-1" },
  ],
] as const;

describe("workspace command core", () => {
  it.each(commandCases)("parses %s", (text, expected) => {
    expect(parseWorkspaceCommand(text)).toEqual(expected);
  });

  it("limits agents by policy while allowing participant workspace changes", async () => {
    const state = new MemoryStateStore();
    await state.saveContact({
      id: "concierge-id",
      name: "Concierge",
      agentCardUrl: "https://concierge.example/card",
      description: "",
      supportsStreaming: true,
      createdAt: "now",
    });
    await state.saveContact({
      id: "research-id",
      name: "Researcher",
      agentCardUrl: "https://research.example/card",
      description: "",
      supportsStreaming: true,
      createdAt: "now",
    });
    const commands = new WorkspaceCommands(
      state,
      {} as A2AConnector,
      runtimeConfig,
    );
    const scope = {
      surface,
      agentAliases: ["concierge"],
      defaultAgent: "concierge",
    };

    const listed = await commands.execute(
      { group: "agent", action: "list" },
      scope,
    );
    expect(listed).toMatchObject({ kind: "agent-list" });
    expect(
      listed.kind === "agent-list" && listed.agents.map((agent) => agent.id),
    ).toEqual(["concierge-id"]);
    await expect(
      commands.execute(
        { group: "agent", action: "use", agent: "researcher" },
        scope,
      ),
    ).resolves.toMatchObject({ kind: "error" });
    await expect(
      commands.execute(
        { group: "session", action: "new", arguments: [] },
        scope,
      ),
    ).resolves.toMatchObject({ kind: "session-new" });
  });

  it("creates and resumes sessions only on their original surface", async () => {
    const state = new MemoryStateStore();
    await state.saveContact({
      id: "concierge-id",
      name: "Concierge",
      agentCardUrl: "https://concierge.example/card",
      description: "",
      supportsStreaming: true,
      createdAt: "now",
    });
    const commands = new WorkspaceCommands(
      state,
      {} as A2AConnector,
      runtimeConfig,
    );
    const scope = {
      surface,
      agentAliases: ["concierge"],
      defaultAgent: "concierge",
    };
    const created = await commands.execute(
      { group: "session", action: "new", arguments: ["concierge"] },
      scope,
    );
    expect(created.kind).toBe("session-new");
    if (created.kind !== "session-new") return;
    await expect(
      commands.execute(
        { group: "session", action: "use", session: created.session.id },
        { ...scope, surface: { ...surface, id: "thread-2" } },
      ),
    ).resolves.toMatchObject({ kind: "error" });
    await expect(
      commands.execute(
        { group: "session", action: "use", session: created.session.id },
        scope,
      ),
    ).resolves.toMatchObject({ kind: "session-selected" });
  });

  it("selects the only Agent allowed by a direct-message policy", async () => {
    const state = new MemoryStateStore();
    await state.saveContact({
      id: "concierge-id",
      name: "Concierge",
      agentCardUrl: "https://concierge.example/card",
      description: "",
      supportsStreaming: true,
      createdAt: "now",
    });
    const commands = new WorkspaceCommands(
      state,
      {} as A2AConnector,
      runtimeConfig,
    );

    await expect(
      commands.execute(
        { group: "agent", action: "current" },
        {
          surface: { platform: "slack", kind: "dm", id: "D123" },
          agentAliases: ["concierge"],
          defaultAgent: "concierge",
        },
      ),
    ).resolves.toMatchObject({
      kind: "agent-current",
      agent: { id: "concierge-id" },
    });
  });
});
