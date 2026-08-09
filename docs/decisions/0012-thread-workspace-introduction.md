# ADR-0012: Thread workspace introduction

- **Status**: accepted
- **Date**: 2026-08-09
- **Proposal**: [thread-workspace-introduction](../proposal/thread-workspace-introduction/README.md)

## Context

Shared thread state is local bridge metadata. A participant joining later needs
to know which Agent is active and how to send it work without first discovering
or running a command.

## Decision

Post one workspace-introduction message when a public thread creates a new
Session. It names the Agent and configured alias, shows the bridge Session ID,
and renders the active Discord bot mention. The same introduction is returned
when an authorized user starts a new Session in a thread.

## Consequences

Threads become self-describing without exposing remote credentials or requiring
a command. The introduction is informative only; the existing Agent-reply label
and mention-gated ingress remain authoritative.
