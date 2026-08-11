# Proposal: Conversation-surface coverage

- **Status**: implemented
- **Author**: Herman Haggerty
- **Created**: 2026-08-10
- **ADR(s)**: [0018](../../decisions/0018-conversation-surface-coverage.md)

## Problem

The bridge currently treats Slack DMs as message ingress but routes native
`/a2a` commands only through allowlisted channels. It also leaves group direct
messages and private Discord threads without a documented, deliberate outcome.
Collaborators need predictable A2A behavior wherever their platform supports a
text conversation.

## Proposal

Classify every text conversation as a private direct surface, a shared direct
surface, a channel launch surface, an active thread workspace, or explicitly
unsupported:

| Surface                                                       | Behavior                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Discord bot DM / Slack DM                                     | Private Surface; commands and ordinary text work.                         |
| Slack group DM                                                | Shared direct Surface; explicitly allowlist agents for that conversation. |
| Discord or Slack public/private channel                       | Allowlisted launch surface; `session new` creates a thread workspace.     |
| Discord or Slack thread                                       | Active shared workspace; inherits the parent conversation's agent policy. |
| Discord group DM, archived/unavailable threads, Slack Connect | Explicitly unsupported.                                                   |

Platform membership and administration govern participation. The bridge limits
only the agents available to a shared conversation. Slack DMs may use all
configured agents; if exactly one is configured, it is selected automatically.

## A2A integration points

- Each supported conversation maps to one bridge `Surface`; Sessions remain
  scoped to that Surface and preserve the opaque remote `contextId`.
- Agent Card discovery, explicit per-agent authentication, streaming, Tasks,
  and recovery do not change.
- A Slack group DM uses its own Surface and cannot share a Session or remote
  context with a channel thread or another DM.

## Alternatives considered

- **Treat every Slack conversation as a thread workspace** — rejected because
  direct conversations are already focused private or shared workspaces.
- **Create bridge-owned roles for group DMs** — rejected because platform
  membership is the collaboration boundary.
- **Claim Discord group-DM support** — rejected because Discord bots cannot be
  participants in group DMs.

## Open questions

None. Slack Connect remains intentionally out of scope until external-member
handling has a dedicated design.
