# Slack adapter

**Audience:** operators connecting Slack to the bridge, then collaborators who
will use its A2A workspaces.

Complete [Get started](../getting-started.md) before connecting Slack. The
adapter uses Socket Mode, so it connects to a self-hosted bridge over WebSockets
without a public HTTP endpoint.

## Choose a chat type

| Where people collaborate          | Support                   | First action                                                                        |
| --------------------------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| 1:1 direct message                | Supported when configured | Open a DM with the app and use `/a2a` or ordinary text.                             |
| Group direct message              | Supported when configured | Add its conversation ID to policy, then use `/a2a` or ordinary text.                |
| Public or private channel         | Supported as a launcher   | Add it to policy, invite the app, then run `/a2a workspace start ...`.              |
| Thread below a configured channel | Supported                 | Mention `@A2ABridge` to request work; use the header or text commands for controls. |
| Slack Connect conversation        | Unsupported               | Use a conversation owned by the configured workspace.                               |

## Fastest first success

1. Follow [Slack setup](setup.md) to import the manifest, enable Socket Mode,
   configure tokens, and allowlist a shared conversation when needed.
2. Open a DM with the app and run:

   ```text
   /a2a agent list
   /a2a agent use concierge
   ```

3. Send ordinary text, such as `Draft a customer onboarding plan.`

For a shared workspace, use an allowlisted Slack channel:

```text
/a2a workspace start concierge Prepare a release checklist
```

The bridge opens a Slack thread and posts a workspace header. In that thread:

```text
@A2ABridge Assign owners to the checklist.
```

## Continue

- [Set up Slack](setup.md) — manifest, scopes, Socket Mode, tokens, and conversation IDs.
- [Use Slack workspaces](workspaces.md) — DMs, group DMs, channels, threads, and troubleshooting.
- [Command reference](../commands.md) — the shared Agent, Session, and Task contract.
- [Configuration reference](../configuration.md)
- [Operations and troubleshooting](../operations.md)
