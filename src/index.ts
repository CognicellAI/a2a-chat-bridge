import { loadConfig } from "./config.js";
import { A2AConnector } from "./core/a2a-connector.js";
import { ContactRegistry } from "./core/contacts.js";
import { RuntimeConfig } from "./core/runtime-config.js";
import { WorkspaceCommands } from "./core/workspace-commands.js";
import { DiscordAdapter } from "./discord/adapter.js";
import { SlackAdapter } from "./slack/adapter.js";
import { JsonStateStore } from "./infra/json-state-store.js";

const configPath = process.env.A2A_CHAT_BRIDGE_CONFIG ?? "./config.yaml";
const config = await loadConfig(configPath);
const state = new JsonStateStore(config.stateFile);
const contacts = new ContactRegistry(state);
const runtimeConfig = new RuntimeConfig(config, configPath);
const connector = new A2AConnector(state, {
  runtimeConfig,
  pollIntervalMs: config.pollIntervalMs,
  editIntervalMs: config.editIntervalMs,
});
const workspaceCommands = new WorkspaceCommands(
  state,
  connector,
  runtimeConfig,
);
if (config.discord) {
  const token = process.env[config.discord.tokenEnv];
  if (!token)
    throw new Error(`Missing Discord token in ${config.discord.tokenEnv}.`);
  await new DiscordAdapter(
    token,
    state,
    contacts,
    connector,
    runtimeConfig,
    workspaceCommands,
  ).start();
}
if (config.slack) {
  const botToken = process.env[config.slack.botTokenEnv];
  const appToken = process.env[config.slack.appTokenEnv];
  if (!botToken || !appToken)
    throw new Error(
      `Missing Slack tokens in ${config.slack.botTokenEnv} and/or ${config.slack.appTokenEnv}.`,
    );
  await new SlackAdapter(
    botToken,
    appToken,
    state,
    contacts,
    connector,
    runtimeConfig,
    workspaceCommands,
  ).start();
}
