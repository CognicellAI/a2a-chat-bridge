# Configuration reference

`config.yaml` is private, hot-reloaded configuration. Start from
[`config.example.yaml`](../../config.example.yaml). Use the adapter guides for
platform-app setup: [Discord](discord/README.md) and [Slack](slack/README.md).

```yaml
discord:
  tokenEnv: DISCORD_BOT_TOKEN
  channels: []
slack:
  botTokenEnv: SLACK_BOT_TOKEN
  appTokenEnv: SLACK_APP_TOKEN
  conversations: []
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

| Key                      | Default             | Purpose                                                      |
| ------------------------ | ------------------- | ------------------------------------------------------------ |
| `discord.tokenEnv`       | —                   | Required environment-variable name for the Discord token.    |
| `discord.channels`       | `[]`                | Parent-channel policy and its allowed Agent aliases.         |
| `slack.conversations`    | `[]`                | Shared Slack channel or group-DM policy and allowed aliases. |
| `stateFile`              | `./data/state.json` | Local Session and Task metadata.                             |
| `editIntervalMs`         | `1200`              | Minimum interval between streaming-reply edits.              |
| `pollIntervalMs`         | `1500`              | `GetTask` polling interval for non-streaming agents.         |
| `configReloadIntervalMs` | `2000`              | Configuration check interval.                                |
| `agents`                 | omitted             | Remote-agent allowlist; use `[]` to manage an empty list.    |

## Agents and authentication

`agentCardUrl` is required. `alias` is optional, unique lowercase kebab-case,
and accepted by `/a2a agent use`. See the [command reference](commands.md) for
the complete user-facing contract.

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

## Discord shared workspaces

Leave `channels` empty for DMs only. Each entry enables public or private threads below one
parent and restricts them to its configured Agent aliases:

```yaml
discord:
  channels:
    - id: "123456789012345678"
      agents: [architect, researcher]
      defaultAgent: architect
```

`agents` is required and must name configured aliases; `defaultAgent` is
optional and must appear in `agents`. Any eligible-thread participant may change
the agent or Session within this allowlist. Root-channel and unmentioned thread
messages are ignored. Discord group DMs are unavailable to bots. See [Discord integration and usage](discord/README.md)
for permissions and workflow.

## Reload and state

Save a complete replacement of `config.yaml`; a valid file takes effect at the
next reload check. Contacts, aliases, authentication, and channel policies
reload. The token variable, state path, and timing settings require a restart.

The state file is rebuildable metadata only. Removing it forgets local Contacts,
Sessions, and Task records; it does not cancel remote A2A work.

For Docker, Compose mounts local `config.yaml` read-only at `/app/config.yaml`.

## Slack Socket Mode

Slack is optional. It uses `SLACK_BOT_TOKEN` plus a separate Socket Mode
`SLACK_APP_TOKEN`; keep both in `.env`, never in this file. Slack DMs support
the full native command contract and ordinary text. In an allowlisted Slack channel,
`/a2a session new [agent] [request]` creates a shared workspace thread. In that
thread, mention the bot for an agent request or send `@A2ABridge /a2a …` for
controls.

```yaml
slack:
  botTokenEnv: SLACK_BOT_TOKEN
  appTokenEnv: SLACK_APP_TOKEN
  conversations:
    - id: C0123456789
      agents: [concierge]
      defaultAgent: concierge
```

All Slack channel or group-DM participants may select an allowlisted agent and
create or resume a shared Session. A group DM uses its own conversation ID and
works directly without a thread. Configure Slack with `app_mentions:read`,
`im:history`, `im:read`, `mpim:history`, `mpim:read`, `channels:read`,
`groups:read`, `chat:write`, and `commands`; enable interactivity; Socket Mode
requires an app token with `connections:write`. Import
[`app-manifest.yaml`](slack/app-manifest.yaml) or register `/a2a` in the Slack
app settings, then reinstall the app.

Use `/a2a session new [agent] [request]` to create a workspace thread. Mention
the bot there to send work to its shared Session. The Block Kit header identifies
the selected agent and Session. All participants can invoke the agent, inspect
Tasks, and change the workspace within its configured agent allowlist.

For manifest import, token creation, workspace launch, and Slack-specific
troubleshooting, see [Slack integration and usage](slack/README.md).
