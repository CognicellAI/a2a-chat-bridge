---
shaping: true
---

# Slack interaction context — Spike

## Context

Discord's native `/a2a` command runs in a known DM or thread Surface. Slack may
deliver slash-command and interactive payloads with different context fields.
The adapter must not mutate a shared Session in the wrong thread.

## Goal

Describe how a Slack user invokes Contact, Session, and Task controls in a DM
and in a shared thread, including the exact stable identifier used to select the
Surface.

## Questions

| #         | Question                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| **X1-Q1** | Which Socket Mode slash-command and interaction payload fields identify a parent channel and a thread?                     |
| **X1-Q2** | Can `/a2a contact use …` run with unambiguous thread context from Slack's composer?                                        |
| **X1-Q3** | If it cannot, which explicit mention-command or Block Kit interaction preserves the target thread safely?                  |
| **X1-Q4** | How should Slack DM and shared-thread command responses be rendered so workspace state remains visible and comprehensible? |

## Acceptance

The spike is complete when we can describe safe, surface-specific invocation and
response flows for every existing `/a2a` operation.
