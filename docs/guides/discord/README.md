# Discord adapter

**Audience:** operators connecting Discord to the bridge, then collaborators who
will use its A2A workspaces.

Complete [Get started](../getting-started.md) before connecting Discord.

## Choose a chat type

| Where people collaborate         | Support                   | First action                                                       |
| -------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| Bot direct message               | Supported when configured | Open a DM with the bot and use `/a2a` or ordinary text.            |
| Public or private parent channel | Supported as a launcher   | Run `/a2a session new ...`; the bridge creates a workspace thread. |
| Thread below a configured parent | Supported                 | Mention `@A2ABridge` to send requests.                             |
| Group direct message             | Unsupported               | Discord bots cannot join group DMs.                                |

## Fastest first success

1. Follow [Discord setup](setup.md) to create and install the bot, configure
   its token, and allowlist the Agents available in private DMs or shared workspaces.
2. Open a DM with the bot and run:

   ```text
   /a2a agent list
   /a2a agent use concierge
   ```

3. Send an ordinary message, such as `Draft a customer onboarding workflow.`

For a shared workspace, run this in an allowlisted parent channel instead:

```text
/a2a session new researcher Compare three deployment options
```

The bridge creates a thread. In that thread, send a request with:

```text
@A2ABridge Turn that comparison into a decision memo.
```

## Continue

- [Set up Discord](setup.md) — application, permissions, tokens, and channel IDs.
- [Use Discord workspaces](workspaces.md) — DMs, threads, collaboration, and troubleshooting.
- [Command reference](../commands.md) — the shared Agent, Session, and Task contract.
- [Configuration reference](../configuration.md)
- [Operations and troubleshooting](../operations.md)
