# Configuration reference

`config.yaml` is private, hot-reloaded configuration. Start from
[`config.example.yaml`](../../config.example.yaml).

```yaml
discord:
  tokenEnv: DISCORD_BOT_TOKEN
  channels: []
slack:
  botTokenEnv: SLACK_BOT_TOKEN
  appTokenEnv: SLACK_APP_TOKEN
  channels: []
stateFile: ./data/state.json

agents:
  - agentCardUrl: https://agent.example/.well-known/agent-card.json
    alias: concierge
    auth:
      type: oauth-client-credentials
      tokenUrl: https://auth.example/oauth/token
      clientId: bridge-client-id
      clientSecret: replace-with-a-secret
      scopes: [a2a.invoke]
```

## Settings

| Key                      | Default             | Purpose                                                   |
| ------------------------ | ------------------- | --------------------------------------------------------- |
| `discord.tokenEnv`       | —                   | Required environment-variable name for the Discord token. |
| `discord.channels`       | `[]`                | Parent-channel policy and its allowed Agent aliases.      |
| `stateFile`              | `./data/state.json` | Local Session and Task metadata.                          |
| `editIntervalMs`         | `1200`              | Minimum interval between streaming-reply edits.           |
| `pollIntervalMs`         | `1500`              | `GetTask` polling interval for non-streaming agents.      |
| `configReloadIntervalMs` | `2000`              | Configuration check interval.                             |
| `agents`                 | omitted             | Contact allowlist; use `[]` to manage an empty list.      |

## Agents and authentication

`agentCardUrl` is required. `alias` is optional, unique lowercase kebab-case,
and accepted by `/a2a contact use`.

An agent may be public (no `auth`) or select one explicit auth mode:

```yaml
# OAuth client credentials: access tokens stay in memory and refresh before expiry.
auth:
  type: oauth-client-credentials
  tokenUrl: https://auth.example/oauth/token
  clientId: bridge-client-id
  clientSecret: replace-with-a-secret
  scopes: [a2a.invoke]

# Static headers: sent only for this agent.
auth:
  type: static-headers
  headers:
    Authorization: Bearer replace-with-a-token
```

The old top-level `contactCredentials` key is rejected. Authentication never
falls back from one mode to another.

## Shared public threads

Leave `channels` empty for DMs only. Each entry enables public threads below one
parent and restricts them to its configured Agent aliases:

```yaml
discord:
  channels:
    - id: "123456789012345678"
      agents: [architect, researcher]
      defaultAgent: architect
```

`agents` is required and must name configured aliases; `defaultAgent` is
optional and must appear in `agents`. Users mention the bot to forward a
message. The thread starter or `Manage Threads` members control Contact and
Session changes. Private threads, root channels, and unmentioned messages are
ignored.

## Reload and state

Save a complete replacement of `config.yaml`; a valid file takes effect at the
next reload check. Contacts, aliases, authentication, and channel policies
reload. The token variable, state path, and timing settings require a restart.

The state file is rebuildable metadata only. Removing it forgets local Contacts,
Sessions, and Task records; it does not cancel remote A2A work.

For Docker, Compose mounts local `config.yaml` read-only at `/app/config.yaml`.

## Slack Socket Mode

Slack is optional. It uses `SLACK_BOT_TOKEN` plus a separate Socket Mode
`SLACK_APP_TOKEN`; keep both in `.env`, never in this file. Slack DMs accept
ordinary text. In an allowlisted Slack channel thread, mention the bot for an
agent request or send `@Bridge /a2a …` for controls.

```yaml
slack:
  botTokenEnv: SLACK_BOT_TOKEN
  appTokenEnv: SLACK_APP_TOKEN
  channels:
    - id: C0123456789
      agents: [concierge]
      defaultAgent: concierge
      mutators: [U0123456789]
```

`mutators` is required and contains Slack user IDs allowed to change a shared
thread's Contact or Session. All thread participants may invoke and inspect the
selected agent. Configure Slack with `app_mentions:read`, `im:history`, and
`chat:write`; Socket Mode requires an app token with `connections:write`.
