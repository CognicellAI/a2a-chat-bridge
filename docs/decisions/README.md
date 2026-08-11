# Decisions — ADRs

Architecture Decision Records: why the design changed. One file per decision:

```text
NNNN-kebab-case-title.md     # numbered sequentially per app: 0001-…, 0002-…
```

Rules:

- Copy [0000-adr-template.md](0000-adr-template.md) to start a new ADR.
- An ADR explains **why**: context, decision, alternatives considered, consequences.
- Accepted ADRs are immutable. To reverse one, write a new ADR that supersedes it
  (and set `Status: superseded by ADR-XXXX` on the old one).
- Link the motivating proposal from `../proposal/`, and update `../architecture/`
  in the same change.

## Index

| ADR                                                    | Title                                             | Status     | Date       |
| ------------------------------------------------------ | ------------------------------------------------- | ---------- | ---------- |
| [0001](0001-chat-bridge-as-cpe-mvp.md)                 | a2a-chat-bridge as self-hosted CPE — MVP shape    | accepted   | 2026-08-08 |
| [0002](0002-typescript-with-portable-core.md)          | TypeScript stack with a portable A2A client core  | accepted   | 2026-08-08 |
| [0003](0003-contact-model-ux.md)                       | Contact-model UX (messaging-native, DM-first)     | accepted   | 2026-08-08 |
| [0004](0004-operator-managed-m2m-oauth.md)             | Operator-managed M2M OAuth for Contacts           | superseded | 2026-08-08 |
| [0005](0005-dynamic-operator-contact-onboarding.md)    | Dynamic operator Contact onboarding               | superseded | 2026-08-08 |
| [0006](0006-trusted-oauth-issuer-metadata.md)          | Trusted OAuth issuer metadata for M2M credentials | superseded | 2026-08-08 |
| [0007](0007-hot-reloaded-local-agent-configuration.md) | Hot-reloaded local Agent configuration            | accepted   | 2026-08-08 |
| [0008](0008-archived-sessions-and-task-records.md)     | Archived Sessions and Task Records                | accepted   | 2026-08-09 |
| [0009](0009-public-thread-workspaces.md)               | Public Discord thread workspaces                  | superseded | 2026-08-09 |
| [0010](0010-explicit-per-agent-authentication.md)      | Explicit per-Agent authentication                 | accepted   | 2026-08-09 |
| [0011](0011-channel-agent-policies.md)                 | Channel-scoped Agent policies                     | accepted   | 2026-08-09 |
| [0012](0012-thread-workspace-introduction.md)          | Thread workspace introduction                     | accepted   | 2026-08-09 |
| [0013](0013-public-v0-release-governance.md)           | Public v0.1.0 release governance                  | accepted   | 2026-08-09 |
| [0014](0014-slack-socket-mode-adapter.md)              | Slack Socket Mode adapter                         | superseded | 2026-08-10 |
| [0015](0015-native-slack-command-launcher.md)          | Native Slack command launcher                     | accepted   | 2026-08-10 |
| [0016](0016-cross-platform-command-parity.md)          | Cross-platform command parity                     | superseded | 2026-08-10 |
| [0017](0017-native-platform-collaboration.md)          | Native-platform collaboration                     | accepted   | 2026-08-10 |
| [0018](0018-conversation-surface-coverage.md)          | Conversation-surface coverage                     | superseded | 2026-08-10 |
| [0019](0019-direct-message-agent-policy.md)            | Direct-message Agent policy                       | accepted   | 2026-08-10 |
| [0020](0020-explicit-workspace-launch-command.md)      | Explicit workspace launch command                 | accepted   | 2026-08-10 |
