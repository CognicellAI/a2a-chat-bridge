# ADR-0003: Contact-model UX (messaging-native, DM-first)

- **Status**: accepted
- **Date**: 2026-08-08
- **Proposal**: [multi-platform-bridge](../proposal/multi-platform-bridge/README.md)

## Context

Early sketches used a telephony-shaped UX (`/dial <url>`, `/hangup`, thread
follow). That frame is right for the _architecture_ (CPE/handset) but foreign to
how chat users actually behave: they add contacts and message them. The A2A spec
itself calls the Agent Card "a digital business card."

## Decision

Adopt the messaging-native model: users add **Contacts** by Agent Card URL and
hold **Conversations** on natural **Surfaces**. Discord v1 surfaces: DMs
(primary — exempt from the privileged Message Content intent), threads later
(shared surface), channel @mention as ambient entry that opens a thread. One
persistent Conversation per Contact per DM, bound to one A2A `contextId`.

## Alternatives considered

- **Telephony UX** (`/dial` + `/hangup`): rejected as foreign to chat platforms.
- **Thread-first**: worse for 1:1 dogfooding; requires the privileged intent.
- **Slash-command-per-message**: most rigid; threads never become Conversations.

## Consequences

- v1 needs no privileged Discord intent (DMs are exempt) — zero-friction
  dogfooding.
- The adapter interface must be Surface-generic; the core knows only Contacts and
  Conversations (see the root `CONTEXT.md` glossary).
- Thread-follow will later need the Message Content intent (self-serve below 10k
  users; app verification at 100+ guilds) or mention-gating.
