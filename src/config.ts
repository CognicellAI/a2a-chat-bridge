import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";

export interface M2MOAuthConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: readonly string[];
}

export interface StaticHeadersAuthConfig {
  type: "static-headers";
  headers: Readonly<Record<string, string>>;
}

export interface OAuthClientCredentialsAuthConfig extends M2MOAuthConfig {
  type: "oauth-client-credentials";
}

export type AgentAuthConfig =
  OAuthClientCredentialsAuthConfig | StaticHeadersAuthConfig;

export interface ConfiguredAgent {
  agentCardUrl: string;
  /** Optional operator-friendly name accepted by `/use`. */
  alias?: string;
  /** Explicit authentication mode for this remote A2A agent. */
  auth?: AgentAuthConfig;
}

export interface DiscordConfig {
  tokenEnv: string;
  /** Public-thread workspaces, each scoped to its parent channel and agents. */
  channels: readonly ChannelPolicy[];
}

export interface SlackConfig {
  botTokenEnv: string;
  appTokenEnv: string;
  /** Shared Slack conversations, scoped to configured agents. */
  conversations: readonly SlackConversationPolicy[];
}

export interface ChannelPolicy {
  id: string;
  /** Configured Agent aliases available in child workspaces. */
  agents: readonly string[];
  /** Optional initial Agent alias for a new thread workspace. */
  defaultAgent?: string;
}

export type SlackConversationPolicy = ChannelPolicy;

/** Agent selection explicitly available to every private 1:1 bot DM. */
export interface DirectMessagePolicy {
  agents: readonly string[];
  defaultAgent?: string;
}

export interface Config {
  discord?: DiscordConfig;
  slack?: SlackConfig;
  /** Absent means private bot DMs are disabled across every adapter. */
  directMessages?: DirectMessagePolicy;
  stateFile: string;
  editIntervalMs: number;
  pollIntervalMs: number;
  configReloadIntervalMs: number;
  managesContacts: boolean;
  agents: readonly ConfiguredAgent[];
}

interface RawOAuthConfig {
  type?: unknown;
  tokenUrl?: unknown;
  clientId?: unknown;
  clientSecret?: unknown;
  scopes?: unknown;
  headers?: unknown;
}

interface RawConfiguredAgent {
  agentCardUrl?: unknown;
  alias?: unknown;
  auth?: RawAuthConfig;
}

type RawAuthConfig = RawOAuthConfig;

interface RawConfig {
  discord?: { tokenEnv?: unknown; channels?: unknown };
  slack?: {
    botTokenEnv?: unknown;
    appTokenEnv?: unknown;
    conversations?: unknown;
    channels?: unknown;
  };
  directMessages?: unknown;
  stateFile?: unknown;
  editIntervalMs?: unknown;
  pollIntervalMs?: unknown;
  configReloadIntervalMs?: unknown;
  agents?: unknown;
}

const positiveNumber = (
  value: unknown,
  name: string,
  fallback: number,
): number => {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new Error(`${name} must be a positive number.`);
  return value;
};

const url = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !value)
    throw new Error(`${name} is required.`);
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
};

const stringList = (value: unknown, name: string): readonly string[] => {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !item)
  )
    throw new Error(`${name} must be a list of non-empty strings.`);
  return Object.freeze([...value]);
};

const staticHeaders = (
  value: unknown,
  name: string,
): StaticHeadersAuthConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${name} must be a header mapping.`);
  const entries = Object.entries(value);
  if (entries.some(([header, value]) => !header || typeof value !== "string"))
    throw new Error(`${name} must contain non-empty header names and strings.`);
  return Object.freeze({
    type: "static-headers",
    headers: Object.freeze(
      Object.fromEntries(entries) as Record<string, string>,
    ),
  });
};

const conversationPolicy = (
  raw: unknown,
  index: number,
  path: string,
): ChannelPolicy => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(`${path}[${index}] must be a mapping.`);
  const candidate = raw as {
    id?: unknown;
    agents?: unknown;
    defaultAgent?: unknown;
  };
  if (typeof candidate.id !== "string" || !candidate.id)
    throw new Error(`${path}[${index}].id is required.`);
  const agents = stringList(candidate.agents, `${path}[${index}].agents`);
  if (!agents.length)
    throw new Error(`${path}[${index}].agents must not be empty.`);
  if (new Set(agents).size !== agents.length)
    throw new Error(`${path}[${index}].agents has duplicates.`);
  const defaultAgent = aliasValue(
    candidate.defaultAgent,
    `${path}[${index}].defaultAgent`,
  );
  if (defaultAgent && !agents.includes(defaultAgent))
    throw new Error(`${path}[${index}].defaultAgent must appear in agents.`);
  return Object.freeze({ id: candidate.id, agents, defaultAgent });
};

const directMessagePolicy = (raw: unknown): DirectMessagePolicy => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("config.directMessages must be a mapping.");
  const candidate = raw as { agents?: unknown; defaultAgent?: unknown };
  const agents = stringList(candidate.agents, "config.directMessages.agents");
  if (!agents.length)
    throw new Error("config.directMessages.agents must not be empty.");
  if (new Set(agents).size !== agents.length)
    throw new Error("config.directMessages.agents has duplicates.");
  const defaultAgent = aliasValue(
    candidate.defaultAgent,
    "config.directMessages.defaultAgent",
  );
  if (defaultAgent && !agents.includes(defaultAgent))
    throw new Error(
      "config.directMessages.defaultAgent must appear in agents.",
    );
  return Object.freeze({ agents, defaultAgent });
};

const channelPolicy = (raw: unknown, index: number): ChannelPolicy =>
  conversationPolicy(raw, index, "config.discord.channels");

const slackConversationPolicy = (
  raw: unknown,
  index: number,
): SlackConversationPolicy =>
  conversationPolicy(raw, index, "config.slack.conversations");

const agent = (raw: unknown, index: number): ConfiguredAgent => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(`agents[${index}] must be a mapping.`);
  const candidate = raw as RawConfiguredAgent;
  const agentCardUrl = url(
    candidate.agentCardUrl,
    `agents[${index}].agentCardUrl`,
  );
  const alias = aliasValue(candidate.alias, `agents[${index}].alias`);
  if (candidate.auth === undefined)
    return Object.freeze({ agentCardUrl, alias });
  const auth = candidate.auth;
  if (!auth || typeof auth !== "object" || Array.isArray(auth))
    throw new Error(`agents[${index}].auth must be a mapping.`);
  if (auth.type === "static-headers")
    return Object.freeze({
      agentCardUrl,
      alias,
      auth: staticHeaders(auth.headers, `agents[${index}].auth.headers`),
    });
  if (auth.type !== "oauth-client-credentials")
    throw new Error(
      `agents[${index}].auth.type must be oauth-client-credentials or static-headers.`,
    );
  if (typeof auth.clientId !== "string" || !auth.clientId)
    throw new Error(`agents[${index}].auth.clientId is required.`);
  if (typeof auth.clientSecret !== "string" || !auth.clientSecret)
    throw new Error(`agents[${index}].auth.clientSecret is required.`);
  return Object.freeze({
    agentCardUrl,
    alias,
    auth: Object.freeze({
      type: "oauth-client-credentials",
      tokenUrl: url(auth.tokenUrl, `agents[${index}].auth.tokenUrl`),
      clientId: auth.clientId,
      clientSecret: auth.clientSecret,
      scopes: stringList(auth.scopes, `agents[${index}].auth.scopes`),
    }),
  });
};

const aliasValue = (value: unknown, name: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(value))
    throw new Error(
      `${name} must be a lowercase kebab-case identifier of at most 63 characters.`,
    );
  return value;
};

export async function loadConfig(
  path = process.env.A2A_CHAT_BRIDGE_CONFIG ?? "./config.yaml",
): Promise<Config> {
  const resolvedPath = resolve(path);
  const parsed = YAML.parse(await readFile(resolvedPath, "utf8")) as RawConfig;
  if ("contactCredentials" in parsed)
    throw new Error(
      "contactCredentials is unsupported. Declare auth on the corresponding agents entry instead.",
    );
  if (parsed.discord && "threadParentChannelIds" in parsed.discord)
    throw new Error(
      "config.discord.threadParentChannelIds is unsupported. Use config.discord.channels instead.",
    );
  if (parsed.slack && "channels" in parsed.slack)
    throw new Error(
      "config.slack.channels is unsupported. Use config.slack.conversations instead.",
    );
  const tokenEnv = parsed.discord?.tokenEnv;
  if (parsed.discord && (typeof tokenEnv !== "string" || !tokenEnv))
    throw new Error("config.discord.tokenEnv is required.");
  const slackBotTokenEnv = parsed.slack?.botTokenEnv;
  const slackAppTokenEnv = parsed.slack?.appTokenEnv;
  if (
    parsed.slack &&
    (typeof slackBotTokenEnv !== "string" ||
      !slackBotTokenEnv ||
      typeof slackAppTokenEnv !== "string" ||
      !slackAppTokenEnv)
  )
    throw new Error(
      "config.slack.botTokenEnv and config.slack.appTokenEnv are required.",
    );
  if (!parsed.discord && !parsed.slack)
    throw new Error("Configure at least one chat platform: discord or slack.");
  const stateFile = parsed.stateFile ?? "./data/state.json";
  if (typeof stateFile !== "string" || !stateFile)
    throw new Error("stateFile must be a non-empty string.");
  if (parsed.agents !== undefined && !Array.isArray(parsed.agents))
    throw new Error("agents must be a list.");
  const agents = Object.freeze((parsed.agents ?? []).map(agent));
  if (
    parsed.discord?.channels !== undefined &&
    !Array.isArray(parsed.discord.channels)
  )
    throw new Error("config.discord.channels must be a list.");
  const channels = Object.freeze(
    (parsed.discord?.channels ?? []).map(channelPolicy),
  );
  if (
    parsed.slack?.conversations !== undefined &&
    !Array.isArray(parsed.slack.conversations)
  )
    throw new Error("config.slack.conversations must be a list.");
  const slackConversations = Object.freeze(
    (parsed.slack?.conversations ?? []).map(slackConversationPolicy),
  );
  const directMessages =
    parsed.directMessages === undefined
      ? undefined
      : directMessagePolicy(parsed.directMessages);
  const duplicate = agents.find(
    (configured, index) =>
      agents.findIndex(
        (item) => item.agentCardUrl === configured.agentCardUrl,
      ) !== index,
  );
  if (duplicate)
    throw new Error(`agents contains duplicate URL ${duplicate.agentCardUrl}.`);
  const duplicateAlias = agents.find(
    (configured, index) =>
      configured.alias !== undefined &&
      agents.findIndex((item) => item.alias === configured.alias) !== index,
  );
  if (duplicateAlias)
    throw new Error(`agents contains duplicate alias ${duplicateAlias.alias}.`);
  const configuredAliases = new Set(
    agents.flatMap((configured) =>
      configured.alias === undefined ? [] : [configured.alias],
    ),
  );
  for (const channel of channels)
    for (const alias of channel.agents)
      if (!configuredAliases.has(alias))
        throw new Error(
          `config.discord.channels entry ${channel.id} references unknown Agent alias ${alias}.`,
        );
  for (const conversation of slackConversations)
    for (const alias of conversation.agents)
      if (!configuredAliases.has(alias))
        throw new Error(
          `config.slack.conversations entry ${conversation.id} references unknown Agent alias ${alias}.`,
        );
  for (const alias of directMessages?.agents ?? [])
    if (!configuredAliases.has(alias))
      throw new Error(
        `config.directMessages references unknown Agent alias ${alias}.`,
      );
  if (new Set(channels.map((channel) => channel.id)).size !== channels.length)
    throw new Error("config.discord.channels contains duplicate IDs.");
  if (
    new Set(slackConversations.map((conversation) => conversation.id)).size !==
    slackConversations.length
  )
    throw new Error("config.slack.conversations contains duplicate IDs.");
  return Object.freeze({
    discord: parsed.discord
      ? Object.freeze({ tokenEnv: tokenEnv as string, channels })
      : undefined,
    slack: parsed.slack
      ? Object.freeze({
          botTokenEnv: slackBotTokenEnv as string,
          appTokenEnv: slackAppTokenEnv as string,
          conversations: slackConversations,
        })
      : undefined,
    directMessages,
    stateFile: resolve(stateFile),
    editIntervalMs: positiveNumber(
      parsed.editIntervalMs,
      "editIntervalMs",
      1_200,
    ),
    pollIntervalMs: positiveNumber(
      parsed.pollIntervalMs,
      "pollIntervalMs",
      1_500,
    ),
    configReloadIntervalMs: positiveNumber(
      parsed.configReloadIntervalMs,
      "configReloadIntervalMs",
      2_000,
    ),
    managesContacts: parsed.agents !== undefined,
    agents,
  });
}
