# Proposal: Public v0.1.0 release

- **Status**: implemented
- **Author**: Herman Haggerty
- **Created**: 2026-08-09
- **ADR(s)**: [0013](../../decisions/0013-public-v0-release-governance.md)

## Problem

The bridge is ready to be shared, but a public project needs clear licensing,
security reporting, contribution expectations, automated verification, and a
repeatable release path.

## Proposal

Release the source and Docker deployment as `v0.1.0` under Apache-2.0. Provide
minimal project policies, CI that runs the existing checks, and a short release
checklist. Keep npm publishing disabled until explicitly adopted as a delivery
channel.

## A2A integration points

No A2A transport or Agent behavior changes. The release documents existing
v1.0-client behavior and preserves the operator-managed Agent configuration
model.

## Alternatives considered

- **MIT** — simpler but lacks Apache-2.0's express patent grant.
- **npm publishing now** — deferred; source and Docker are the supported release
  artifacts for v0.1.0.

## Open questions

- Confirm the public repository name before setting GitHub repository metadata.
