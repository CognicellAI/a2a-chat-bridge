---
shaping: true
---

# Slack adapter — Frame

## Source

> OK now that we have this release. Lets capture the Slack adapter proposal.
> Essentially the same logic for discord but now slack.

---

## Problem

Discord users can select configured A2A agents and collaborate in a controlled
thread workspace. Slack users currently have no equivalent surface, despite the
same need to make deliberate, visible agent work part of a team conversation.

## Outcome

A Slack workspace owner can self-host the bridge, configure the same remote A2A
agents, and give their team predictable DMs and shared-thread workspaces. The
adapter preserves the bridge's A2A and authorization boundaries while using
Slack-native delivery and interaction mechanisms.

## Boundary for the first proof

One Slack workspace, one bot installation, Slack Socket Mode, text-only A2A
messages, Slack DMs, and allowlisted-channel threads. Multi-workspace OAuth,
files, external shared-channel behavior, and a new cross-platform state model
are out of scope.
