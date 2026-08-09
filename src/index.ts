import { loadConfig } from "./config.js";
import { A2AConnector } from "./core/a2a-connector.js";
import { ContactRegistry } from "./core/contacts.js";
import { RuntimeConfig } from "./core/runtime-config.js";
import { DiscordAdapter } from "./discord/adapter.js";
import { JsonStateStore } from "./infra/json-state-store.js";

const configPath = process.env.A2A_CHAT_BRIDGE_CONFIG ?? "./config.yaml";
const config = await loadConfig(configPath);
const token = process.env[config.discord.tokenEnv];
if (!token)
  throw new Error(`Missing Discord token in ${config.discord.tokenEnv}.`);
const state = new JsonStateStore(config.stateFile);
const contacts = new ContactRegistry(state);
const runtimeConfig = new RuntimeConfig(config, configPath);
const connector = new A2AConnector(state, {
  runtimeConfig,
  pollIntervalMs: config.pollIntervalMs,
  editIntervalMs: config.editIntervalMs,
});
await new DiscordAdapter(
  token,
  state,
  contacts,
  connector,
  runtimeConfig,
).start();
