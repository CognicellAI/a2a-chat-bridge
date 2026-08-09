# ADR-0008: Archived Sessions and Task Records

- **Status**: accepted
- **Date**: 2026-08-09
- **Proposal**: [session-history-and-task-inspection](../proposal/session-history-and-task-inspection/README.md)

## Context

The bridge previously retained only one current Conversation per Contact and
Discord DM. Starting a new A2A context required deleting that mapping, so users
could not return to the prior context. Users also need diagnostics for the A2A
Tasks the bridge initiated without making opaque server IDs the routine UX.

## Decision

The bridge persists bridge-owned Sessions, with one selected Session per Contact
and Surface. Starting a new Session archives the current selection and creates a
new record on the next user message. Earlier Sessions remain listable and
selectable. The remote `contextId` is stored as opaque metadata on the Session.

The bridge persists Task records for Tasks it initiates, associated with the
owning Session. It displays friendly local references first and raw remote IDs
only in inspection output. Explicit task inspection uses the Contact's A2A
credentials and `GetTask`; remote state remains authoritative.

## Alternatives considered

- **One replaceable Conversation mapping** — rejected because new-session
  commands destroy return navigation.
- **Client-generated context IDs** — rejected because A2A servers own context
  semantics and clients should treat server IDs as opaque.
- **Remote-only session/task history** — rejected because history/list APIs and
  retention are agent-dependent.

## Consequences

- Soft state gains Session and Task record indexes but remains rebuildable.
- `/a2a session new` becomes non-destructive, while `/a2a session use` can
  restore a prior remote context.
- Task inspection is limited to bridge-recorded Tasks and may report a remote
  capability/error rather than invent a status.
- Updates [the component architecture](../architecture/03-components.md) and
  [operations guide](../guides/operations.md).
