# Proposal: Cross-platform command parity

- **Status**: implemented
- **Author**: Herman Haggerty
- **Created**: 2026-08-10
- **ADR(s)**: [0016](../../decisions/0016-cross-platform-command-parity.md)

## Problem

Discord and Slack expose the bridge's Agent, Session, and Task controls through
different, partially overlapping command sets. Collaborators should learn one
set of A2A workspace operations regardless of chat platform.

## Proposal

Standardize the user-facing vocabulary on `agent`, `session`, and `task`:

```text
/a2a agent list|current|use <agent>
/a2a session new [agent] [request]
/a2a session current|list|use <session>
/a2a task current|list|status <task>
```

Discord exposes the contract as native application commands. In an allowlisted
parent channel, `session new` creates a workspace thread; in a DM or existing
thread it starts a fresh Session. Slack exposes `session new` and `agent list`
as native slash-command launch actions, then renders the remaining operations as
Block Kit controls in the workspace thread. Mention-prefixed text commands remain
the Slack thread fallback because Slack developer slash commands cannot run there.

## A2A integration points

- Contact discovery, explicit per-Agent authentication, A2A transport, remote
  `contextId`, and Task recovery semantics remain unchanged.
- Commands operate only on bridge-owned Contact, Session, and Task metadata for
  the resolved platform Surface.
- A shared command core owns command validation, policy filtering, and mutation
  authorization. Platform adapters only parse interactions, create threads, and
  render outcomes.

## Alternatives considered

- Keep independent adapter commands — inevitably drifts in behavior and docs.
- Require Slack text commands only — preserves control parity but not a native
  Slack workflow.
- Force identical widgets — impossible because Slack slash commands are not
  available inside threads.

## Open questions

None for this implementation. Agent-owned platform identities are a separate
future proposal.
