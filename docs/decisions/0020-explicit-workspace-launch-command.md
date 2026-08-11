# ADR-0020: Explicit workspace launch command

- **Status**: accepted
- **Date**: 2026-08-10
- **Proposal**: [workspace-launch-command](../proposal/workspace-launch-command/README.md)

## Context

The original cross-platform command contract used `session new` both to create a
fresh conversation and to launch a shared channel-thread workspace. Those are
distinct user intentions: a workspace defines who collaborates and where;
a Session selects the local binding to an opaque remote `contextId` within that
already-established Surface.

## Decision

Use `/a2a workspace start [agent] [request]` as the only parent-channel
workspace-launch operation. It creates the Discord or Slack thread and creates
its first Session. Use `/a2a session new [agent]` only in a supported DM, group
DM, or existing workspace thread to start a fresh conversation on that Surface.

The shared command core parses both command groups. Adapters own workspace
creation because only they can create a platform-native thread. Slack native
commands remain unavailable inside message threads, where the Block Kit header
and `@A2ABridge /a2a …` text controls manage the existing workspace.

## Alternatives considered

- **One overloaded `session new`** — rejected because its result depends on
  location in a surprising way.
- **A platform-specific channel command** — rejected because future adapters
  should share the same collaboration vocabulary.
- **Treat a workspace as a remote A2A context** — rejected because a workspace
  is bridge-owned Surface state; the remote agent owns `contextId`.

## Consequences

Parent-channel guides, Discord application-command registration, Slack native
slash-command handling, and command help use `workspace start`. Existing
`session new` commands with an initial request are intentionally removed rather
than retained as aliases. ADR-0016 is superseded.
