# ADR-0002: TypeScript stack with a portable A2A client core

- **Status**: accepted
- **Date**: 2026-08-08
- **Proposal**: [multi-platform-bridge](../proposal/multi-platform-bridge/README.md)

## Context

The bridge needs an A2A v1.0 client and a Discord library, must ship as an
easy-to-run artifact (CPE), and its core should outlive any single adapter.
Primary-source verification (see the proposal's research note) confirmed
`@a2a-js/sdk` v1.0.x covers the full client surface with a Workers-safe
(no-Node-API) build, and discord.js runs on Bun.

## Decision

Implement in TypeScript: `@a2a-js/sdk` for the A2A client core, `discord.js` for
the Discord adapter, one process, distributed as a Bun single executable
(`bun build --compile`). The core module is platform-agnostic — no Node APIs —
so it can be lifted into other runtimes or languages later.

## Alternatives considered

- **Rust core with WASM/FFI bindings** (or all-Rust via serenity + a2a-rs):
  rejected for v1 — FFI tax, two toolchains, no concrete WASM host for a
  bot-token daemon, and a2a-rs is the least-mature official SDK. The portable
  core keeps a later rewrite un-foreclosed.
- **gRPC transport support**: out of scope — gRPC is Node-only in the SDK and
  breaks the portable core. JSON-RPC and HTTP+JSON/REST bindings only.

## Consequences

- First implementation ticket: spike `bun build --compile` + `ws` + `undici`
  (research flagged the combination as covered only by general compatibility
  statements).
- A2A v1.0 only; the SDK's opt-in `legacyCompat` (v0.3) stays off unless a
  concrete need appears.
- Use `SubscribeToTask` for restart recovery — it directly supports the
  soft-state corollary.
