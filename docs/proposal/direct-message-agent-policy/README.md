# Proposal: Direct-message Agent policy

- **Status**: implemented
- **Author**: Herman Haggerty
- **Created**: 2026-08-10
- **ADR(s)**: [0019](../../decisions/0019-direct-message-agent-policy.md)

## Problem

Private Discord and Slack bot DMs currently expose every bridge-managed Agent.
That turns platform access to a bot into implicit permission to invoke any
remote Agent and its configured credential.

## Proposal

Add one optional, cross-adapter `directMessages` policy with an Agent allowlist
and optional default Agent. Direct messages are disabled when the policy is
absent. When present, Discord bot DMs and Slack App Home DMs use the same
allowlist, while Slack group DMs and channel-thread workspaces retain their
existing per-conversation policies.

```yaml
directMessages:
  agents: [concierge]
  defaultAgent: concierge
```

The policy limits remote Agent selection only. Discord and Slack still govern
who can access the bot and who participates in shared conversations.

## A2A integration points

- A DM remains one private Surface per platform conversation; its local Session
  still maps only to that Surface's opaque remote `contextId`.
- Agent Card discovery, Tasks, streaming, and per-Agent authentication do not
  change.
- The policy prevents unapproved Agent selection before an A2A request is sent.

## Alternatives considered

- **Keep unrestricted DMs** — rejected because adding a privileged Agent silently
  expands every user's authority.
- **Bridge-owned per-user roles** — rejected because platform membership remains
  the participation boundary.
- **Adapter-specific DM policies** — rejected because the trust boundary is the
  same across adapters and should not diverge by platform.

## Open questions

None.
