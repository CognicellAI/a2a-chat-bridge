# ADR-0019: Direct-message Agent policy

- **Status**: accepted
- **Date**: 2026-08-10
- **Proposal**: [direct-message-agent-policy](../proposal/direct-message-agent-policy/README.md)

## Context

The bridge treats a 1:1 bot DM as a private Surface. Platform access is not an
A2A authorization boundary: invoking a remote Agent can expose data, consume
capacity, and use the bridge's configured credential. Existing shared
conversation policies constrain Agent selection, but DMs do not.

## Decision

Use an explicit, cross-adapter top-level `directMessages` policy. It contains
the aliases available to private Discord bot DMs and Slack App Home DMs, plus an
optional default. Direct-message ingress and `/a2a` commands are disabled when
the policy is absent. Slack group DMs remain governed by their own configured
conversation policy.

## Alternatives considered

- **All configured Agents in DMs** — rejected because it grants new Agents to
  every participant without a policy change.
- **Adapter-local DM policies** — rejected because equivalent private Surfaces
  should have equivalent Agent boundaries.
- **Bridge-local user authorization** — rejected because it duplicates platform
  membership administration.

## Consequences

Operators must opt in to private DM use and deliberately select safe Agents.
Adding a new configured Agent no longer broadens DM access. The Surface model,
adapter guides, configuration reference, and example configuration document the
new policy.
