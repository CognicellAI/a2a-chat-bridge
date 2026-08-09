# ADR-0013: Public v0.1.0 release governance

- **Status**: accepted
- **Date**: 2026-08-09
- **Proposal**: [public-v0-release](../proposal/public-v0-release/README.md)

## Context

The bridge is being released as open source. Users and contributors need clear
reuse terms, a private vulnerability-reporting path, automated verification, and
a repeatable release process. The project is currently distributed as source and
a Docker deployment, not an npm package.

## Decision

Release v0.1.0 under Apache-2.0 with Herman Haggerty as author and CognicellAI
as the project maintainer. Add concise contributor, security, and conduct
policies; a GitHub Actions verification workflow; and a release checklist. Keep
the npm package private until npm distribution is an explicit product decision.

## Alternatives considered

- **MIT** — rejected in favor of Apache-2.0's explicit patent grant.
- **No formal release process** — rejected because it makes source releases
  difficult to verify and reproduce.

## Consequences

The public repository has a clear governance baseline and CI runs the same
formatting, type, test, build, and Compose checks used locally. Runtime
architecture is unchanged.
