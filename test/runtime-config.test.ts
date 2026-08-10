import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { RuntimeConfig } from "../src/core/runtime-config.js";

let directory = "";
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

const writeConfig = async (file: string, agents = "") =>
  writeFile(
    file,
    `discord:\n  tokenEnv: DISCORD_BOT_TOKEN\nstateFile: ./data/state.json\n${agents}`,
  );

describe("Runtime configuration", () => {
  it("accepts a unique kebab-case alias for a configured agent", async () => {
    directory = await mkdtemp(join(tmpdir(), "a2a-chat-bridge-"));
    const file = join(directory, "config.yaml");
    await writeConfig(
      file,
      "agents:\n  - agentCardUrl: https://agent.example/.well-known/agent-card.json\n    alias: concierge\n    auth:\n      type: static-headers\n      headers:\n        Authorization: Bearer test-token\n",
    );

    await expect(loadConfig(file)).resolves.toMatchObject({
      agents: [
        {
          agentCardUrl: "https://agent.example/.well-known/agent-card.json",
          alias: "concierge",
          auth: {
            type: "static-headers",
            headers: { Authorization: "Bearer test-token" },
          },
        },
      ],
    });
  });

  it("rejects the removed top-level static credential map", async () => {
    directory = await mkdtemp(join(tmpdir(), "a2a-chat-bridge-"));
    const file = join(directory, "config.yaml");
    await writeConfig(file, "contactCredentials: {}\n");

    await expect(loadConfig(file)).rejects.toThrow(
      "contactCredentials is unsupported",
    );
  });

  it("rejects the removed thread parent ID list", async () => {
    directory = await mkdtemp(join(tmpdir(), "a2a-chat-bridge-"));
    const file = join(directory, "config.yaml");
    await writeFile(
      file,
      "discord:\n  tokenEnv: DISCORD_BOT_TOKEN\n  threadParentChannelIds: [parent-1]\nstateFile: ./data/state.json\n",
    );

    await expect(loadConfig(file)).rejects.toThrow(
      "threadParentChannelIds is unsupported",
    );
  });

  it("accepts channel policies with an Agent allowlist and default", async () => {
    directory = await mkdtemp(join(tmpdir(), "a2a-chat-bridge-"));
    const file = join(directory, "config.yaml");
    await writeFile(
      file,
      "discord:\n  tokenEnv: DISCORD_BOT_TOKEN\n  channels:\n    - id: parent-1\n      agents: [concierge]\n      defaultAgent: concierge\nstateFile: ./data/state.json\nagents:\n  - agentCardUrl: https://agent.example/.well-known/agent-card.json\n    alias: concierge\n",
    );

    await expect(loadConfig(file)).resolves.toMatchObject({
      discord: {
        channels: [
          {
            id: "parent-1",
            agents: ["concierge"],
            defaultAgent: "concierge",
          },
        ],
      },
    });
  });

  it("accepts a Slack Socket Mode policy without bridge-owned mutators", async () => {
    directory = await mkdtemp(join(tmpdir(), "a2a-chat-bridge-"));
    const file = join(directory, "config.yaml");
    await writeFile(
      file,
      "slack:\n  botTokenEnv: SLACK_BOT_TOKEN\n  appTokenEnv: SLACK_APP_TOKEN\n  channels:\n    - id: C0123456789\n      agents: [concierge]\n      defaultAgent: concierge\nstateFile: ./data/state.json\nagents:\n  - agentCardUrl: https://agent.example/.well-known/agent-card.json\n    alias: concierge\n",
    );

    await expect(loadConfig(file)).resolves.toMatchObject({
      discord: undefined,
      slack: {
        botTokenEnv: "SLACK_BOT_TOKEN",
        appTokenEnv: "SLACK_APP_TOKEN",
        channels: [{ id: "C0123456789", agents: ["concierge"] }],
      },
    });
  });

  it("rejects a channel policy that names an unknown Agent alias", async () => {
    directory = await mkdtemp(join(tmpdir(), "a2a-chat-bridge-"));
    const file = join(directory, "config.yaml");
    await writeFile(
      file,
      "discord:\n  tokenEnv: DISCORD_BOT_TOKEN\n  channels:\n    - id: parent-1\n      agents: [missing]\nstateFile: ./data/state.json\nagents: []\n",
    );

    await expect(loadConfig(file)).rejects.toThrow(
      "references unknown Agent alias missing",
    );
  });

  it("atomically swaps a valid configuration and preserves the previous snapshot on failure", async () => {
    directory = await mkdtemp(join(tmpdir(), "a2a-chat-bridge-"));
    const file = join(directory, "config.yaml");
    await writeConfig(file);
    const runtime = new RuntimeConfig(await loadConfig(file), file);

    await writeConfig(
      file,
      "agents:\n  - agentCardUrl: https://agent.example/.well-known/agent-card.json\n",
    );
    expect(await runtime.reload()).toBe(true);
    expect(runtime.snapshot().revision).toBe(2);
    expect(
      runtime.isConfigured("https://agent.example/.well-known/agent-card.json"),
    ).toBe(true);

    await writeConfig(file, "agents: []\n");
    expect(await runtime.reload()).toBe(true);
    expect(runtime.snapshot().revision).toBe(3);
    expect(runtime.snapshot().config.managesContacts).toBe(true);
    expect(
      runtime.isConfigured("https://agent.example/.well-known/agent-card.json"),
    ).toBe(false);

    await writeFile(file, "agents: not-a-list\n");
    await expect(runtime.reload()).rejects.toThrow(
      "Configure at least one chat platform",
    );
    expect(runtime.snapshot().revision).toBe(3);
    expect(runtime.snapshot().config.managesContacts).toBe(true);
  });
});
