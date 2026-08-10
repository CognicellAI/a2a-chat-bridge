# Proposal: Slack adapter

- **Status**: draft
- **Author**: Herman Haggerty
- **Created**: 2026-08-09
- **Shaping**: [frame](frame.md), [working shape](shaping.md)
- **Research**: [Slack transport notes](research.md),
  [Slack configuration](research-slack-config.md)
- **ADR(s)**: —

## Problem

The bridge has a proven Discord adapter, but teams often collaborate in Slack.
They need the same explicit A2A-agent workflow without turning the bridge into a
hosted router or creating divergent Contact, Session, or Task semantics.

## Proposal

Add a Slack adapter alongside Discord. It will use the same configured Contacts,
explicit authentication, local Session records, remote A2A `contextId`, and Task
metadata. Slack DMs will be personal Surfaces; an eligible Slack thread will be
a shared agent workspace with one selected Contact and one active Session.

The first adapter shape uses Slack Socket Mode and Bolt for JavaScript so a
self-hosted bridge receives events over an outbound connection rather than
opening a public inbound endpoint. Users invoke an agent with an explicit bot
mention. The proof retains the Discord policy: owner-level users mutate shared
workspace state; all permitted participants invoke the selected agent and inspect
its metadata.

## A2A integration points

- **Discovery and auth**: unchanged; the operator's exact Agent Card URL and
  explicit per-Agent auth mode remain authoritative.
- **Messaging**: unchanged; use streaming when the Agent Card supports it and
  non-blocking send plus polling otherwise.
- **State mapping**: `slack:dm:<channel-id>` and
  `slack:thread:<channel-id>:<thread-ts>` map to the existing local Session and
  Task record model. The remote server alone assigns `contextId`.
- **Recovery**: unchanged; unsupported optional task resubscription is a local
  recovery limitation, not a Slack-visible error.

## Deferred from the first proof

- Slack Connect / shared-channel policy;
- private-channel and private-conversation policy beyond an installed bot's
  confirmed access;
- Slack file/artifact upload and rich Block Kit output;
- Slack OAuth installation and multi-workspace tenancy;
- a generic multi-platform command grammar or cross-platform shared Session;
- per-user A2A authorization.

## Open questions

See [shaping.md](shaping.md). Native Slack slash commands cannot run in message
threads, so thread controls use `@Bridge /a2a …`; shared-thread mutator
authorization remains the key open design question.
