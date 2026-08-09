# ADR-0010: Explicit per-Agent authentication

- **Status**: accepted
- **Date**: 2026-08-09

## Context

The bridge previously allowed a top-level map of static headers keyed by Agent
Card URL. A configured OAuth credential took precedence when both forms were
present. This created an implicit fallback path and separated a Contact's
identity from its authentication policy.

## Decision

Each configured Agent may declare exactly one optional `auth` object. Its
`type` is either `oauth-client-credentials` or `static-headers`. OAuth obtains
and refreshes an in-memory access token; static headers are attached only for
that Agent. An Agent without `auth` is invoked without authentication.

The legacy top-level `contactCredentials` key is rejected at configuration load.

## Alternatives considered

- **Keep the top-level header map as fallback** — rejected because it silently
  changes an Agent's credential behavior and makes audits harder.
- **Permit OAuth and static headers on one Agent** — rejected because precedence
  rules obscure which secret authenticates a request.

## Consequences

Authentication is visible in the configured Agent's single record and cannot
cross Contact boundaries. Existing configurations must migrate to `auth`; a
legacy credential map fails fast rather than being ignored or used.
