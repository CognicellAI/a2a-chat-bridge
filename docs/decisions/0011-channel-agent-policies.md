# ADR-0011: Channel-scoped Agent policies

- **Status**: accepted
- **Date**: 2026-08-09
- **Proposal**: [discord-thread-workspaces](../proposal/discord-thread-workspaces/README.md)

## Context

An ID-only parent-channel allowlist enables a thread but cannot express which
remote Agents are appropriate for that workspace. It leaves every configured
Agent selectable from every enabled thread.

## Decision

Replace the parent-channel ID list with `discord.channels`. Each entry contains
one parent `id`, required configured Agent `agents` aliases, and an optional
`defaultAgent`. A public thread is eligible only below a configured parent.

The policy limits `/a2a contact list`, `/a2a contact use`, and automatic Contact
selection in its threads. A policy's default is selected first; otherwise the
bridge auto-selects only when its allowed list contains one Agent.

## Alternatives considered

- **Keep a separate ID allowlist plus a second mapping** — rejected because it
  duplicates enablement state and makes policy harder to read.
- **Use generated Contact IDs in policies** — rejected because IDs are runtime
  metadata; configured aliases are stable operator handles.

## Consequences

One concise policy enables a workspace and sets its Agent boundary. Operators
must assign aliases to Agents referenced by a channel policy. DMs retain access
to all configured Agents.
