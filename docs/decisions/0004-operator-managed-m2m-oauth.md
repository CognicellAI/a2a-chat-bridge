# ADR-0004: Operator-managed M2M OAuth for Contacts

- **Status**: superseded by ADR-0006
- **Date**: 2026-08-08
- **Proposal**: [multi-platform-bridge](../proposal/multi-platform-bridge/README.md)

## Context

The bridge must invoke authenticated remote A2A agents without exposing long-lived credentials in Discord. The current deployment is self-hosted and single-tenant, and the current agents use OAuth 2.0 client credentials. The Agent Card already declares the authorization server metadata and requested scopes, while the operator owns the client identity and secret.

## Decision

The bridge supports operator-managed M2M OAuth only. The Contact whitelist remains operator-controlled. For each authenticated Contact, the bridge reads the token URL and scopes from the Agent Card; attachment configuration supplies the client ID and an environment-variable reference for the client secret. The bridge obtains and renews access tokens itself. Discord exposes authentication status and recovery actions only, never credential entry.

## Alternatives considered

- **Paste tokens or secrets into Discord** — rejected because Discord is not the bridge's secret store and message inputs are delivered to the app.
- **Place token URL, scopes, and secrets entirely in local configuration** — rejected because it duplicates agent-owned security metadata and risks configuration drift.
- **Per-user browser OAuth** — deferred. It needs user-to-Contact authorization ownership, secure per-user token storage, and a separate shaped proposal.

## Consequences

- The configuration schema needs a per-Contact M2M credential reference, not a static bearer-header map.
- The A2A Connector needs a token provider that caches tokens only until shortly before expiry and renews them without Discord involvement.
- Agent Cards must be refreshed or re-read when the bridge needs current OAuth metadata.
- Architecture pages 02 and 03 describe the resulting credential boundary.
