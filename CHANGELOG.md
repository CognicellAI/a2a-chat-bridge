# Changelog

All notable changes are recorded here.

## [0.2.0] - 2026-08-10

### Added

- Slack Socket Mode support, including native `/a2a` workspace launch, shared
  Slack threads, and Block Kit workspace controls.
- One cross-platform `/a2a` command contract for agents, Sessions, remote
  `contextId`, and Task metadata.
- Adapter-native operator guides, a shared command reference, and an
  importable Slack app manifest.

### Changed

- Shared workspaces now use platform-native membership for collaboration while
  channel policy limits the approved agents.
- User-facing commands and guides use **agent**; Contact remains an internal
  domain term.

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
