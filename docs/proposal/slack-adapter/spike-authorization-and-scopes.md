---
shaping: true
---

# Slack authorization and scopes — Spike

## Context

The Discord adapter limits shared workspaces by parent channel and protects
Contact/Session mutation. Slack must provide an equivalent explicit policy
without over-requesting scopes or trusting a mutable display attribute.

## Goal

Describe the least-privilege Slack scopes, event subscriptions, and stable
authorization data needed for DMs and allowlisted shared-thread workspaces.

## Questions

| #         | Question                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| **X2-Q1** | Which bot scopes are required for bot-DM messages, `app_mention`, posting and updating replies, and Socket Mode? |
| **X2-Q2** | Which Slack API data identifies a conversation's type, membership, and workspace-level administrator privileges? |
| **X2-Q3** | What authorization policy is reliable for changing a shared thread's Contact or Session?                         |
| **X2-Q4** | How should public, private, and Slack Connect conversations be distinguished and bounded in v1?                  |

## Acceptance

The spike is complete when we can publish a minimal Slack manifest and a stable
authorization rule for the first proof.
