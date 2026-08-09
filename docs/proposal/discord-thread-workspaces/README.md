# Proposal: Discord thread workspaces

- **Status**: implemented
- **Author**: dubh3124
- **Created**: 2026-08-09
- **Shaping**: [frame](frame.md), [working shape](shaping.md)
- **Decision**: [ADR-0009](../../decisions/0009-public-thread-workspaces.md),
  [ADR-0011](../../decisions/0011-channel-agent-policies.md)

## Problem

The bridge currently supports only one-person Discord DMs. A Discord thread can
host a shared agent workspace, but it needs a deliberate ownership model,
thread-scoped Session isolation, and safe message routing before the adapter can
offer parity with the DM workflow.

## Selected proof shape

Implement a proof of function for one shared agent workspace per eligible public
Discord thread. Human participants collaborate around one selected Contact and
its active Session; multi-agent concurrency is explicitly deferred.

The proof keeps the existing Contact, Session, Task, credential, and A2A
semantics. Its adapter rules are:

- public threads only, under an operator channel policy that declares its allowed
  Agent aliases and optional default;
- one selected Contact and active Session per thread;
- mention-only message ingress for the first proof;
- only the thread starter or a member with `Manage Threads` may change the
  Contact or Session;
- any participant may invoke the selected agent and inspect shared Task metadata;
- thread Contact selection remains in memory across bridge restarts, matching
  current DM behavior.

## Deferred from the proof

- concurrent agents or per-user Sessions in one thread;
- reply-to-bot ingress;
- configured-role authorization;
- private threads;
- persistent Contact selection;
- Slack and other adapters.

## Follow-up questions

See [shaping.md](shaping.md) for deferred design choices that remain open after
the proof implementation.
