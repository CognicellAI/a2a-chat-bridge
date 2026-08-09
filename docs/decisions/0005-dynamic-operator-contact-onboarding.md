# ADR-0005: Dynamic operator Contact onboarding

- **Status**: superseded by ADR-0007
- **Date**: 2026-08-08
- **Proposal**: [multi-platform-bridge](../proposal/multi-platform-bridge/README.md)

## Context

An operator should be able to add an approved remote agent without restarting the bridge, while M2M client secrets must remain outside Discord. The DM-first, user-installed Discord app has no guild-role context, so an authorization rule based on server roles would not secure these actions consistently.

## Decision

Keep M2M credential profiles in local attachment configuration, but let an authorized Operator dynamically pair a Contact's exact Agent Card URL with a configured profile alias. Persist only safe Contact metadata and the profile alias in bridge state. The bridge authorizes administrative Contact commands against configured immutable Discord user IDs. Other Chat users may list, select, and invoke already allowlisted Contacts, but cannot change the whitelist. Role-based administration is deferred until a guild-scoped surface is introduced.

## Alternatives considered

- **Config-only Contacts** — rejected because onboarding an agent would require a configuration edit and bridge restart.
- **Credentials or profile creation through Discord** — rejected because Discord is not the secret store.
- **Server-role authorization now** — rejected because DMs have no guild role context; role IDs would also need an explicit guild boundary.

## Consequences

- State needs a Contact-to-credential-profile association.
- The Discord adapter needs separate operator-only administrative commands and safe status responses.
- Contact pairing validates the exact HTTPS Agent Card URL and verifies its OAuth metadata against the selected profile before persistence.
- Role-based authorization can later extend the authorization policy with explicit `guildId` and `roleId` pairs.
