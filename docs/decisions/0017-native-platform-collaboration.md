# ADR-0017: Native-platform collaboration

- **Status**: accepted
- **Date**: 2026-08-10
- **Proposal**: [native-platform-collaboration](../proposal/native-platform-collaboration/README.md)

## Context

Discord and Slack already own membership, thread access, and administration.
Bridge-specific mutation authorization duplicated these controls and differed by
adapter, undermining the goal of a collaborative shared workspace.

## Decision

Any participant in an eligible workspace may choose an allowlisted agent and
create or resume its A2A Session. The bridge has no cross-platform role model.
It enforces agent allowlists only and posts an audit notice when the workspace's
agent or active Session changes.

## Alternatives considered

- **Bridge-owned mutators and locks** — rejected because they duplicate native
  platform authorization and require a cross-platform role abstraction.
- **Unrestricted global agents** — rejected because operators must be able to
  limit a channel to approved remote agents.

## Consequences

Slack `mutators` and Discord thread-owner mutation checks are removed. Channel
policies simplify to `agents` and optional `defaultAgent`; platform access
remains the effective authorization boundary.
