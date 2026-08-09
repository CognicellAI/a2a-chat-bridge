# ADR-0007: Hot-reloaded local Agent configuration

- **Status**: accepted
- **Date**: 2026-08-08
- **Proposal**: [multi-platform-bridge](../proposal/multi-platform-bridge/README.md)
- **Supersedes**: [ADR-0005](0005-dynamic-operator-contact-onboarding.md), [ADR-0006](0006-trusted-oauth-issuer-metadata.md)

## Context

The immediate goal is streamlined onboarding of M2M-authenticated A2A agents without interrupting active conversations. Dynamic Discord administration and issuer-metadata trust policy add substantial control-plane complexity, while a new agent's unique M2M secret must still be supplied locally.

## Decision

Local YAML configuration is the source of truth for the Contact whitelist. Each Agent configuration contains the exact Agent Card URL and, when required, that Agent's own M2M OAuth token URL, client ID, client secret, and scopes. The bridge polls the mounted configuration file, validates a complete replacement snapshot, and atomically adopts it. Configured Contacts are fetched and made available automatically; Discord provides selection and chat, not credential entry or Contact administration.

An in-flight A2A request retains the configuration snapshot with which it started. Subsequent requests use the latest valid snapshot. Invalid reloads leave the prior snapshot active.

## Alternatives considered

- **Restart the bridge for every change** — rejected because it may interrupt an active stream or leave recovery to optional server capabilities.
- **Discord-driven Contact pairing and credential profiles** — deferred because each new agent has its own secret and Discord must not carry it.
- **Trusted issuer metadata validation** — deferred as later hardening; the first onboarding slice favors explicit local token-endpoint configuration.

## Consequences

- `config.yaml` is a local secret-bearing file and must be ignored by Git and permission-restricted.
- An operator updates the file atomically; a configured Contact becomes available without a Compose recreate.
- A Contact removed from configuration is unavailable for new work, while an active request is allowed to finish.
- Future secret-manager, runtime admin, or OAuth trust-hardening work can replace the configuration source without changing the request-snapshot behavior.
