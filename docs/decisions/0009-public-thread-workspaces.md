# ADR-0009: Public Discord thread workspaces

- **Status**: superseded by [ADR-0017](0017-native-platform-collaboration.md)
- **Date**: 2026-08-09
- **Proposal**: [discord-thread-workspaces](../proposal/discord-thread-workspaces/README.md)

## Context

Discord DMs provide a personal A2A Surface, but collaborative users need a
place to see the same selected agent, conversation context, responses, and Task
metadata. A server root channel is too broad to route safely, and treating every
thread as eligible would expose the bridge where an operator did not intend it.

## Decision

The Discord adapter supports a proof of shared agent workspaces in public threads
whose parent-channel IDs appear in `discord.threadParentChannelIds`. Each thread
maps to one `Surface` and has one selected Contact plus one active Session.

Ordinary thread text is sent to A2A only when it mentions the bot. The thread
starter or a member with Discord's `Manage Threads` permission may change the
Contact or Session. All thread participants may invoke the selected agent and
inspect its shared Task metadata. The allowlist hot-reloads; Contact selection
remains in-memory, consistent with DMs.

## Alternatives considered

- **All guild messages and threads** — rejected because it risks consuming
  unrelated discussion and gives operators no narrow enablement boundary.
- **Allowlisted threads with unrestricted messages** — rejected because normal
  thread conversation could accidentally become agent input.
- **Per-user Contacts and Sessions within a thread** — deferred: it obscures the
  shared work record and adds routing and authorization policy before the proof
  demonstrates collaborative value.

## Consequences

Operators must explicitly allow parent channels and grant the bot access to
their threads. Participants see one shared remote `contextId` and Task list,
which makes collaboration legible but means changes by authorized users affect
everyone in the thread. Private threads, reply-to-bot ingress, configured roles,
multi-agent concurrency, and per-user Sessions remain out of scope.

This decision updates the system context, container, and component architecture
pages and is implemented by the Discord adapter.
