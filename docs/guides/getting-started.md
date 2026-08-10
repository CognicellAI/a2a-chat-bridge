# Get started

**Audience:** a self-hosting operator. **Time:** about 15 minutes before
platform-app setup.

This guide installs the bridge and configures one remote A2A agent. Then choose
[Discord](discord/README.md) or [Slack](slack/README.md) to connect a chat platform.

## Prerequisites

- Bun for local development, or Docker and Docker Compose for a containerized
  deployment.
- An A2A agent's exact Agent Card URL. Do not append or remove discovery-path
  segments from the URL supplied by the agent operator.
- The agent's required authentication material, if its Agent Card requires it.
- A Discord bot token, a Slack bot token and app token, or both—depending on the
  adapters you enable.

## 1. Create private configuration

```sh
cd a2a-chat-bridge
bun install
cp config.example.yaml config.yaml
```

Keep `config.yaml` private. It may contain client secrets or static authorization
headers and must not be committed. Start with one configured agent:

```yaml
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

Use `alias` in chat commands, such as `concierge`. Authentication is explicit
per agent; see [configuration](configuration.md#agents-and-authentication) for
public agents and static headers.

## 2. Provide platform tokens

Use environment variables named by your configuration. Keep actual token values
in your shell environment or a local `.env` file, never in `config.yaml`.

```sh
export DISCORD_BOT_TOKEN='replace-with-discord-token'
export SLACK_BOT_TOKEN='replace-with-slack-bot-token'
export SLACK_APP_TOKEN='replace-with-slack-app-token'
```

You only need variables for enabled adapters. Set the corresponding `discord`
or `slack` block in `config.yaml`; see the adapter guides for examples.

## 3. Run the bridge

For development:

```sh
bun run dev
```

For Docker Compose, copy `.env.example` to `.env`, set only the required token
variables, then run:

```sh
docker compose up --build -d
docker compose logs --tail=100 bridge
```

Compose stores bridge metadata in its named volume. Local development uses the
`stateFile` you configured. That metadata contains local agent, Session, and
Task references—not remote agent work itself.

## 4. Verify startup

Look for one line per enabled adapter:

```text
Connected to Discord as …
Registered /a2a Discord application command.
Connected to Slack through Socket Mode.
```

Next, finish platform integration:

- [Connect Discord](discord/README.md)
- [Connect Slack](slack/README.md)

## Next steps

- [Command reference](commands.md)
- [Configuration reference](configuration.md)
- [Operations and troubleshooting](operations.md)
