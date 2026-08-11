# a2a-chat-bridge guides

**Audience:** operators who self-host the bridge and the collaborators they
invite into its workspaces.

The bridge connects approved remote A2A agents to Discord and Slack. It does not
host agents or inspect their internal memory. A conversation policy limits which
configured agents a shared workspace may use; Discord and Slack retain control
of membership and administration.

## Start here

1. [Get started](getting-started.md) — install the bridge, configure your first
   agent, start the service, and choose an adapter.
2. Connect the adapter you use:
   - [Discord](discord/README.md) — choose a chat type, then follow setup and
     workspace-use guidance.
   - [Slack](slack/README.md) — choose a chat type, then follow setup and
     workspace-use guidance.
3. [Command reference](commands.md) — the shared `/a2a` workspace, agent,
   session, and task commands.

## Operator reference

- [Configuration reference](configuration.md) — every `config.yaml` setting,
  agent authentication mode, reload behavior, and state semantics.
- [Operations and troubleshooting](operations.md) — health checks, recovery,
  and common failures.
- [Slack app manifest](slack/app-manifest.yaml) — importable Slack app settings.

## Future adapters

Each adapter gets a small guide hub with a stable `README.md`, plus `setup.md`
and `workspaces.md` pages. The hub links to this page, the shared [command
reference](commands.md), configuration, and operations pages instead of
duplicating shared concepts.
