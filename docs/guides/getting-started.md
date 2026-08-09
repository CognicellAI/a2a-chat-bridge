# Get started

**Audience:** a workspace owner running the bridge. **Time:** about 15 minutes.

## 1. Install and configure

```sh
cd a2a-chat-bridge
bun install
cp config.example.yaml config.yaml
```

Edit `config.yaml` with your remote A2A agent and its authentication mode:

```yaml
discord:
  tokenEnv: DISCORD_BOT_TOKEN
  channels: [] # optional public-thread workspaces

agents:
  - agentCardUrl: https://agent.example/.well-known/agent-card.json
    alias: concierge
    auth:
      type: oauth-client-credentials
      tokenUrl: https://auth.example/oauth/token
      clientId: replace-with-client-id
      clientSecret: replace-with-client-secret
      scopes: [a2a.invoke]
```

Keep `config.yaml` private. The Agent Card URL is used exactly as written.

## 2. Connect Discord

Create a Discord application and bot, then install it in your test server.
Give it **View Channel**, **Send Messages in Threads**, and application-command
access where it will be used.

```sh
export DISCORD_BOT_TOKEN='paste-the-bot-token-here'
bun run dev
```

The bridge needs no privileged Message Content intent. Successful startup logs
the bot identity and `/a2a` command registration.

## 3. Send the first request

In a bot DM, use `/a2a contact list`. If more than one Contact is listed, use
`/a2a contact use`. Then send ordinary text. The bridge creates a local Session
and retains the remote `contextId` for later messages.

## Optional: collaborate in a public thread

Add a channel policy using the parent text-channel ID and configured Agent
aliases—not a thread ID:

```yaml
discord:
  channels:
    - id: "123456789012345678"
      agents: [concierge]
      defaultAgent: concierge
```

Create a public thread below that channel. Mention the bot to send work to its
shared Session. The thread starter or a member with `Manage Threads` may change
the Contact or Session; all participants can invoke the agent and inspect Tasks.

## Next steps

- [Configuration reference](configuration.md) — every setting and auth mode.
- [Operate the bridge](operations.md) — Contacts, Sessions, Tasks, and recovery.
