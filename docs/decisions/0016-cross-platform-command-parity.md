# ADR-0016: Cross-platform command parity

- **Status**: superseded by [ADR-0020](0020-explicit-workspace-launch-command.md)
- **Date**: 2026-08-10
- **Proposal**: [cross-platform-command-parity](../proposal/cross-platform-command-parity/README.md)

## Context

The Discord and Slack adapters each implement overlapping Agent, Session, and
Task controls. Slack's native commands cannot run in message threads, while
Discord application commands can run in eligible threads.

## Decision

Use one user-facing command contract, naming remote endpoints `agent` rather
than the internal `Contact` type. Implement command execution in a shared core;
adapters translate native commands, thread text, and Slack Block Kit actions to
the same commands and render the resulting view data. `session new` is the
single workspace-launch operation on both platforms.

## Alternatives considered

- **Adapter-local command handlers** — rejected because platform behavior and
  authorization can drift.
- **Legacy aliases** — rejected; the bridge is still in active development.
- **Identical native surfaces** — rejected because Slack constrains slash
  commands to non-thread composers.

## Consequences

Discord adds parent-channel workspace launch. Slack adds interactive workspace
controls and requires `commands` plus interactivity configuration. Documentation
and tests describe semantic parity rather than identical widgets.
