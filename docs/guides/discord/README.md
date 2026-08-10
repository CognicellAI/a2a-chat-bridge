# Discord integration and usage

**Audience:** an operator connecting a Discord server or direct messages to the
bridge.

Complete [Get started](../getting-started.md) first. This guide covers Discord's
native application-command and thread-workspace experience.

## 1. Create and install the Discord app

1. Create an application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy the bot token into the environment variable named by `discord.tokenEnv`.
3. Install the app in the server where it will be used. Include the `bot` and
   `applications.commands` installation scopes.
4. Grant the bot these permissions in every channel used for workspaces:
   **View Channel**, **Send Messages**, **Create Public Threads**, **Create
   Private Threads** (when used), and **Send Messages in Threads**.

The bridge does not require Discord's privileged Message Content intent. It
registers `/a2a` at startup; reopen the command picker if the command is not
immediately visible after installation.

## 2. Configure the adapter

Add the Discord token-variable name to `config.yaml`:

```yaml
discord:
  tokenEnv: DISCORD_BOT_TOKEN
  channels: []
```

Then export the token before starting the bridge:

```sh
export DISCORD_BOT_TOKEN='replace-with-discord-token'
bun run dev
```

Verify the service logs both the connected bot identity and `/a2a` command
registration.

## 3. Use a direct message

Open a DM with the bridge bot and use Discord's command picker:

```text
/a2a agent list
/a2a agent use concierge
```

If only one agent is configured, it is selected automatically. Send ordinary
text to start or continue the A2A conversation. Use the [command reference](../commands.md)
to inspect Sessions, Context IDs, and Tasks.

## 4. Enable a shared thread workspace

Configure the **parent text-channel ID**, not a thread ID. The `agents` list is
the bridge's allowlist for every workspace thread below that channel.

```yaml
discord:
  tokenEnv: DISCORD_BOT_TOKEN
  channels:
    - id: "123456789012345678"
      agents: [concierge, researcher]
      defaultAgent: concierge
```

Restart the bridge after changing `tokenEnv`; valid channel-policy changes are
hot-reloaded. In the allowlisted parent channel, create a workspace with:

```text
/a2a session new concierge Draft a release checklist
```

The bridge creates a thread, posts its active agent and Session, and
forwards the optional request. In that thread, mention the bot to send ordinary
requests:

```text
@A2ABridge Turn that into owner-assigned tasks.
```

Use native `/a2a` commands inside the thread to inspect or change the shared
workspace. Every participant uses the same selected agent and active Session;
the bridge posts a workspace update when either changes.

## Discord behavior and limits

- Public and private threads below configured parent channels are workspace
  surfaces when the bot can access them.
- Root-channel and unmentioned thread messages are ignored by the bridge.
- Discord bots cannot participate in group DMs.
- Discord's server, channel, and thread permissions determine participation.
  The bridge adds no role system.
- A new Session does not cancel remote Tasks started by an earlier Session.

## Troubleshooting

| Symptom                              | Check                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `/a2a` is missing                    | Confirm `Registered /a2a Discord application command.` in logs, then reopen the command picker.  |
| Bot cannot create a workspace thread | Grant the applicable **Create … Threads** and **Send Messages in Threads** permissions.          |
| Bot ignores a thread request         | Use a configured accessible thread and mention `@A2ABridge`.                                     |
| Agent is unavailable                 | Run `/a2a agent list`; the requested alias must be configured and allowed by the parent channel. |
| A2A request fails                    | Run `/a2a agent current`, verify credentials, then inspect remote-agent logs.                    |

## Related guides

- [Command reference](../commands.md)
- [Configuration reference](../configuration.md)
- [Operations and troubleshooting](../operations.md)
