# ADR-0001: a2a-chat-bridge as self-hosted CPE — MVP shape

- **Status**: accepted
- **Date**: 2026-08-08
- **Proposal**: [multi-platform-bridge](../proposal/multi-platform-bridge/README.md)

## Context

A2A agents are opaque HTTP services; users live in chat platforms. Existing
bridges are vendor-bound templates or agent-OS runtimes, and a hosted bridging
service would put an operator in everyone's traffic path — the "peg board
operator" explicitly rejected during shaping. The first user is the author
(dogfooding): one self-hosted deployment, success = daily use.

## Decision

Build a2a-chat-bridge as a self-hosted, single-tenant, single-process **A2A
client** — customer-premises equipment, not network infrastructure (see the
proposal's Reference shape). Discord is the first platform adapter. MVP scope is
the conversational core: Contacts added by Agent Card URL, DM-first
Conversations, text with SSE streaming and a polling fallback. Artifact uploads,
push notifications, threads/shared surfaces, and per-user auth are deferred.

## Alternatives considered

See the proposal's Alternatives table (kagent templates, agent-OS runtimes,
agentgateway, iPaaS, Slack-hosted functions). The hosted/multi-tenant variant was
rejected specifically because it recreates the operator problem.

## Consequences

- Design review holds the switchboard/handset line (proposal, Reference shape):
  no auto-routing, no registry, no mediated trust, no static agent wiring.
- All v1 work fits in one process; no server infrastructure to build.
- Each deferred branch requires its own proposal before implementation.
