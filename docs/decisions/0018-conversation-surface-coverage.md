# ADR-0018: Conversation-surface coverage

- **Status**: superseded by [ADR-0019](0019-direct-message-agent-policy.md)
- **Date**: 2026-08-10
- **Proposal**: [conversation-surface-coverage](../proposal/conversation-surface-coverage/README.md)

## Context

Chat platforms have different direct and shared conversation types. A bridge
must not silently forward text from unsupported spaces, while collaborators
should not need to understand adapter internals to use a supported one. Slack
native slash-command payloads need conversation lookup to distinguish DMs from
channel launch surfaces. Discord bots cannot participate in group DMs.

## Decision

Model direct, group-direct, and thread conversations as explicit bridge
Surfaces. Discord and Slack 1:1 DMs support the full `/a2a` command contract
and ordinary text. Slack group DMs support the same contract only when their
conversation is explicitly allowlisted. Public/private channels are launch
surfaces, and public/private threads inherit their parent conversation's agent
policy when the bot can access them.

The Slack adapter uses conversation metadata to classify native `/a2a`
invocations and requests only the read scopes required for that classification.
Discord group DMs, archived/unavailable threads, and Slack Connect remain
unsupported with clear operator documentation.

## Alternatives considered

- **One generic DM Surface for every direct conversation** — rejected because a
  shared group DM needs an explicit operator agent policy.
- **Treat group DMs as unrestricted** — rejected because group collaborators
  should not automatically receive access to every configured remote agent.
- **Use bridge-local participant roles** — rejected by
  [ADR-0017](0017-native-platform-collaboration.md); platform membership is
  authoritative.

## Consequences

The `Surface` model gains a group-DM variant. Slack configuration calls its
shared policy list `conversations`, allowing public/private channels and group
DMs. Existing Slack `channels` configuration is rejected as a clear migration
instead of preserved as an ambiguous fallback. Slack app manifests add the
conversation-read and group-DM event scopes. The adapter guides and C4 views
document both supported and explicitly unsupported chat types.
