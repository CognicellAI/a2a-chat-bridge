# ADR-0014: Slack Socket Mode adapter

- **Status**: superseded by [ADR-0017](0017-native-platform-collaboration.md)
- **Date**: 2026-08-10
- **Proposal**: [slack-adapter](../proposal/slack-adapter/README.md)

## Context

The bridge needs a Slack adapter with the same A2A Contact, Session, context, and
Task semantics as Discord without adding an inbound public service.

## Decision

Add Slack Socket Mode using Bolt for JavaScript. Slack DMs accept ordinary text;
allowlisted channel threads require a bot mention. Thread controls use
`@Bridge /a2a …` because Slack native slash commands cannot run in threads.
Each Slack channel policy names permitted Agents and explicit Slack user-ID
`mutators` for Contact and Session changes.

## Consequences

Discord and Slack are independent platform adapters, not message routes. Both
reuse the portable A2A core and local state model, while Slack Connect,
private-channel policy, file handling, and workspace-role authorization remain
deferred.
