# Proposal: Explicit workspace launch command

- **Status**: implemented
- **Author**: Herman Haggerty
- **Created**: 2026-08-10
- **ADR(s)**: [0020](../../decisions/0020-explicit-workspace-launch-command.md)

## Problem

`/a2a session new` currently has two different outcomes: in a DM or an existing
thread it creates a fresh Session, while in an allowlisted parent channel it
creates a collaborative thread and a Session. Users cannot predict whether they
are resetting a conversation or creating a team workspace.

## Proposal

Make the collaboration boundary explicit:

```text
/a2a workspace start [agent] [request]
```

This command is valid only in an allowlisted parent channel and creates a shared
thread workspace. Keep Session commands for the active DM, group DM, or existing
thread:

```text
/a2a session new [agent]
/a2a session current|list|use <session>
```

An optional initial request belongs to `workspace start`, because it is sent to
the newly created workspace Session. Ordinary text in a DM continues to start a
Session automatically.

## A2A integration points

The bridge creates one local Session for the new thread Surface. The remote A2A
server generates its opaque `contextId` only after the first request. Agent Card
discovery, per-Agent authentication, streaming, Task tracking, and recovery are
unchanged.

## Alternatives considered

- **Keep the overloaded `session new` command** — rejected because a thread
  launch is a collaboration action, not ordinary session management.
- **Use adapter-specific names** — rejected because the same workspace model
  should apply across current and future adapters.
- **Make every session a thread** — rejected because direct conversations are
  already valid private or shared Session surfaces.

## Open questions

None.
