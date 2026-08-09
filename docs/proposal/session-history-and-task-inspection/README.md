# Proposal: Session history and task inspection

- **Status**: implemented
- **Author**: dubh3124
- **Created**: 2026-08-09
- **ADR(s)**: [0008 — Archived Sessions and Task Records](../../decisions/0008-archived-sessions-and-task-records.md)

## Problem

A single Surface/Contact mapping to one A2A `contextId` makes a new session
destructive: users cannot return to an earlier conversation. Raw remote
`contextId` and `taskId` values are valuable for diagnosis, but are opaque and
too technical to be the primary chat UX.

## Proposal

Persist bridge-owned Sessions for each Contact/Surface pair. A user starts a new
Session by archiving the active one; earlier Sessions remain selectable. Assign
short, friendly bridge Session references for list/use controls, while exposing
the underlying A2A `contextId` only in inspection output.

Persist Task records for Tasks initiated through each Session. Provide controls
to list recorded Tasks and inspect a known Task's latest remote status. The
bridge only tracks Tasks it initiated; it never assumes it can discover arbitrary
remote history.

## A2A integration points

- Reuse the remote server-provided `contextId` when continuing the selected
  Session. A fresh Session omits it until the server assigns a new value.
- Store server-generated `taskId` values and use `GetTask` for explicit status
  inspection where supported.
- Stream or poll behavior stays unchanged; task records are metadata about these
  existing interactions.
- M2M credentials remain local Agent configuration and are reused only to query
  a Task belonging to its Contact.

## Alternatives considered

- **Expose raw context and task IDs as the session UI** — rejected because they
  are opaque server identifiers and hard to select correctly.
- **Delete the current mapping on a new session** — rejected because it prevents
  returning to prior A2A context.
- **Promise remote history discovery** — rejected because support is
  agent-dependent; bridge records are the dependable local index.

## Open questions

None for the initial DM implementation. Human-renamable Sessions and rich task
artifacts are deferred.
