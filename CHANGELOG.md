# Changelog

All notable changes are recorded here.

## [0.1.0] - 2026-08-09

### Added

- Discord DMs and allowlisted public-thread workspaces for remote A2A v1.0
  agents.
- Native `/a2a` controls for Contacts, Sessions, `contextId`, and Task metadata.
- Explicit per-Agent OAuth client-credentials or static-header authentication.
- Docker Compose operation, hot-reloaded Agent configuration, and concise
  operator guides.

### Security

- Agent access is allowlisted by exact Agent Card URL and channel policy.
- Credentials are selected explicitly per Agent; no credential fallback exists.
