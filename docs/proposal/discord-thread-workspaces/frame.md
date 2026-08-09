---
shaping: true
---

# Discord thread workspaces — Frame

## Source

> OK lets shape this
>
> The goal here is collaborative users/agents experience
>
> Lets do 1 first for proof of function
>
> Yes—aim for feature parity, but not identical interaction policy.
>
> A thread can be another Surface:
>
> `discord:thread:<thread-id> + Contact → active Session → remote contextId`
>
> So the same controls should work there: `/a2a contact …`,
> `/a2a session new|current|list|use`, `/a2a task current|list|status`, normal
> agent replies and task metadata, all posted in that thread.
>
> The important difference is ownership. A DM has one human participant; a
> channel thread may be shared. Treat a thread as a shared agent workspace: one
> selected Contact and active Session per thread; only the thread starter, server
> admins, or a configured role can change Contact/session; everyone may send
> messages to the selected agent and view Task metadata; route ordinary text only
> when the bot is mentioned or replied to; configure an allowlist of eligible
> channels; support private threads only when the bot is explicitly a member.

---

## Problem

The DM adapter has an implicit one-person ownership model. Applying it unchanged
to a shared Discord thread would let any participant redirect the shared agent or
reset its conversation, and would risk forwarding unrelated discussion to the
agent.

## Outcome

An authorized Discord thread can become a predictable shared workspace where
human participants and remote A2A agent(s) collaborate around visible work. The
initial shape must make clear whether one selected agent or several concurrently
addressable agents own the thread's active work, without leaking state between
threads or changing A2A protocol semantics.

## Selected proof boundary

The first proof is one selected agent at a time. It validates collaboration among
multiple human participants around a single visible Contact and Session before
introducing concurrent agents in the same thread.
