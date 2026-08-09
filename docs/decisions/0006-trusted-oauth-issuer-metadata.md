# ADR-0006: Trusted OAuth issuer metadata for M2M credentials

- **Status**: superseded by ADR-0007
- **Date**: 2026-08-08
- **Proposal**: [multi-platform-bridge](../proposal/multi-platform-bridge/README.md)
- **Supersedes**: [ADR-0004](0004-operator-managed-m2m-oauth.md)

## Context

M2M credentials are confidential and must not be sent to an endpoint chosen by an arbitrary Agent Card. Although an Agent Card can declare OAuth security metadata, it is remote integration input and not the trust anchor for a credential. OAuth security guidance requires a client that interacts with more than one authorization server to bind authorization-server identity to its endpoints.

## Decision

Each local credential profile declares a trusted OAuth issuer. The bridge retrieves OAuth authorization-server metadata from that issuer and uses its canonical token endpoint and supported scopes to obtain M2M access tokens. During Contact pairing, the bridge checks the Agent Card's OAuth declaration for consistency with the selected profile; a mismatch rejects pairing. Discord never accepts or displays M2M credentials.

## Alternatives considered

- **Trust the token URL in each Agent Card** — rejected because it could cause a client secret to be sent to an attacker-controlled endpoint.
- **Allowlist only token-endpoint URLs** — workable, but rejected in favor of issuer-bound metadata, which is the more durable OAuth trust model.
- **Static bearer tokens** — rejected because tokens expire and require manual replacement.

## Consequences

- Credential profiles configure issuer identity, client ID, and a secret environment-variable reference.
- The token provider validates issuer metadata before using its token endpoint.
- Pairing fails closed if the Agent Card's declared OAuth issuer, token endpoint, or required scopes conflict with the selected profile.
- Architecture descriptions replace Card-owned OAuth metadata with issuer-owned trusted metadata.
