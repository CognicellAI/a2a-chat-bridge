# Proposal: Native-platform collaboration

- **Status**: implemented
- **Author**: Herman Haggerty
- **Created**: 2026-08-10
- **ADR(s)**: [0017](../../decisions/0017-native-platform-collaboration.md)

## Problem

Shared A2A workspaces should let channel participants collaborate. The bridge's
Discord thread-owner and Slack `mutators` checks create a second, inconsistent
permission system on top of each platform's membership and administration model.

## Proposal

Use native platform access as the collaboration boundary. Anyone who can
participate in an allowlisted Discord or Slack workspace can select an approved
agent and create or resume a Session. The bridge continues to enforce only each
channel policy's agent allowlist and emits a visible audit notice for every agent
or Session change.

## A2A integration points

- Agent Cards, explicit per-agent authentication, A2A transport, remote
  `contextId`, Tasks, and recovery behavior do not change.
- The bridge creates and stores Sessions per platform Surface as before.
- Agent selection remains limited to aliases configured on the workspace's
  parent channel.

## Alternatives considered

- Keep `mutators` and Discord thread-owner checks — rejected because they make
  the bridge own collaboration authorization.
- Translate Discord roles into Slack permissions — rejected because the models
  are incompatible and would create platform-specific bridge RBAC.

## Open questions

None. Platform administrators retain their native authority.
