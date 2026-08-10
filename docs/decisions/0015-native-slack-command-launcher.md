# ADR-0015: Native Slack command launcher

- **Status**: superseded by [ADR-0016](0016-cross-platform-command-parity.md)
- **Date**: 2026-08-10
- **Proposal**: [slack-adapter](../proposal/slack-adapter/README.md)

## Context

Slack Socket Mode supports native slash commands, but developer-created commands
cannot be invoked in message threads. The bridge needs a discoverable channel
entry point without weakening the shared-thread boundary.

## Decision

Add native `/a2a` support for `/a2a agents` and `/a2a start [agent] <request>`.
`start` creates a new allowlisted-channel thread, assigns the configured Contact,
and forwards the request as its first A2A message. Existing thread controls remain
explicit `@A2ABridge /a2a …` messages.

## Alternatives considered

- **Mention-only launch** — works, but exposes bridge mechanics and is less discoverable.
- **Native commands in a thread** — unavailable for Slack developer commands.

## Consequences

The Slack app needs the `commands` bot scope and a `/a2a` command registration.
The project supplies an importable manifest and keeps the thread as the canonical
shared A2A Session surface.
