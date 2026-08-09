# Proposals

Proposed ideas for adding features to this app. **One sub-directory per proposal:**

```
docs/proposal/<kebab-case-slug>/README.md   # + any supporting files in the same dir
```

A proposal is an _idea_, not the design. It proposes; it does not define.

- Status lifecycle: `draft → proposed → accepted | rejected`, then `implemented`.
- On `accepted`: fold the design into `../../architecture/` and record the change
  as an ADR in `../../decisions/`. Link the ADR from the proposal.
- On `implemented`: link the PR/commit if useful.

Copy the template below into `docs/proposal/<slug>/README.md`:

---

```markdown
# Proposal: <Title>

- **Status**: draft
- **Author**: <name>
- **Created**: YYYY-MM-DD
- **ADR(s)**: <!-- link once accepted, e.g. ../../decisions/0001-something.md -->

## Problem

What problem or user need does this address? Why now?

## Proposal

The idea, in enough detail to evaluate: behavior, UX, example A2A flows.

## A2A integration points

- Which remote agents / skills does this use? How are they discovered (Agent Cards)?
- Interaction pattern: request/response + polling, SSE streaming, or push notifications?
- Task-based (long-running) or message-based (immediate) responses? Artifacts produced?
- Auth implications (Agent Card security schemes, credentials handling)?

## Alternatives considered

## Open questions
```
