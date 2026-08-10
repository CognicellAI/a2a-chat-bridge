# a2a-chat-bridge guides

**Audience:** operators who self-host the bridge and the collaborators they
invite into its workspaces.

The bridge connects approved remote A2A agents to Discord and Slack. It does not
host, route, or inspect the internal memory of those agents. A channel policy
limits which configured agents a workspace may use; Discord and Slack retain
control of workspace membership and administration.

## Start here

1. [Get started](getting-started.md) — install the bridge, configure your first
   agent, start the service, and choose an adapter.
2. Connect the adapter you use:
   - [Discord](discord/README.md) — bot installation, channel policies, DMs, and
     thread workspaces.
   - [Slack](slack/README.md) — app manifest, Socket Mode, workspace launch, and Block
     Kit controls.
3. [Command reference](commands.md) — the shared `/a2a` agent, session, and
   task commands.

## Operator reference

- [Configuration reference](configuration.md) — every `config.yaml` setting,
  agent authentication mode, reload behavior, and state semantics.
- [Operations and troubleshooting](operations.md) — health checks, recovery,
  and common failures.
- [Slack app manifest](slack/app-manifest.yaml) — importable Slack app settings.

## Future adapters

Each adapter gets one guide that covers its platform-native installation,
permissions, launch surface, message-routing rules, and troubleshooting. It
links to this hub, the shared [command reference](commands.md), configuration,
and operations pages instead of duplicating those concepts.
