---
shaping: true
---

# Slack adapter — Shaping

## CURRENT: Discord-only platform adapter

| Part          | Mechanism                                                                                    | Flag |
| ------------- | -------------------------------------------------------------------------------------------- | :--: |
| **CURRENT-1** | `discord.js` maps DMs and allowlisted public threads to Discord Surfaces.                    |      |
| **CURRENT-2** | Native `/a2a` interactions select Contacts and Sessions and inspect Tasks.                   |      |
| **CURRENT-3** | Mention-gated thread text becomes an A2A message; agent text is rendered as a batched reply. |      |

## Requirements (R)

| ID  | Requirement                                                                                                                                                       | Status    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| R0  | A Slack user can use the same configured A2A Contacts from a DM or an eligible shared thread.                                                                     | Core goal |
| R1  | A Slack Surface retains one selected Contact, active local Session, remote `contextId`, and bridge-recorded Task history without leaking them to another Surface. | Must-have |
| R2  | A Slack shared thread is a visible shared workspace with one selected agent and Session, not interleaved personal contexts.                                       | Must-have |
| R3  | Only explicitly authorized Slack participants can change the shared Contact or Session; permitted participants can invoke and inspect the selected agent.         | Must-have |
| R4  | Unrelated Slack discussion is never sent to an agent implicitly.                                                                                                  | Must-have |
| R5  | The first self-hosted deployment receives Slack events without opening an inbound public HTTP endpoint.                                                           | Must-have |
| R6  | Slack-specific credentials stay in environment configuration; A2A credentials remain explicit per Agent and are never disclosed in Slack.                         | Must-have |
| R7  | Existing Discord behavior and all remote A2A protocol semantics remain unchanged.                                                                                 | Must-have |

## A: Socket Mode workspace parity

Candidate first proof. A thin Slack adapter uses Bolt for JavaScript in Socket
Mode, shares the portable core, and adopts the existing workspace policy.

| Part   | Mechanism                                                                                                                                                      | Flag |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| **A1** | Add a Slack adapter that converts bot-DM events and `app_mention` events into portable text requests and renders batched A2A replies with Slack's message API. |  ⚠️  |
| **A2** | Extend `Surface` with `slack:dm:<channel-id>` and `slack:thread:<channel-id>:<thread-ts>` keys; reuse the existing Session and Task stores.                    |      |
| **A3** | Read hot-reloaded Slack channel policies that limit shared workspaces to configured channel IDs and configured Agent aliases.                                  |  ⚠️  |
| **A4** | Require a bot mention for shared-thread ingress; strip the mention before forwarding text to A2A.                                                              |      |
| **A5** | Resolve mutator authorization from Slack conversation and workspace roles before changing a thread's Contact or Session.                                       |  ⚠️  |
| **A6** | Provide `/a2a` controls where Slack gives sufficient surface context; otherwise parse an explicit bot mention command in the target thread.                    |  ⚠️  |
| **A7** | Add a Slack app manifest and concise installation guide with the minimal Socket Mode, event, and message scopes.                                               |  ⚠️  |

## B: HTTP-event adapter

| Part   | Mechanism                                                                                         | Flag |
| ------ | ------------------------------------------------------------------------------------------------- | :--: |
| **B1** | Reuse A2–A7 but receive Slack Events and commands through a signed public HTTPS request endpoint. |  ⚠️  |

## Fit Check

| Req | Requirement                                                                                                                                                       | Status    |  A  |  B  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | :-: | :-: |
| R0  | A Slack user can use the same configured A2A Contacts from a DM or an eligible shared thread.                                                                     | Core goal | ❌  | ❌  |
| R1  | A Slack Surface retains one selected Contact, active local Session, remote `contextId`, and bridge-recorded Task history without leaking them to another Surface. | Must-have | ✅  | ✅  |
| R2  | A Slack shared thread is a visible shared workspace with one selected agent and Session, not interleaved personal contexts.                                       | Must-have | ✅  | ✅  |
| R3  | Only explicitly authorized Slack participants can change the shared Contact or Session; permitted participants can invoke and inspect the selected agent.         | Must-have | ❌  | ❌  |
| R4  | Unrelated Slack discussion is never sent to an agent implicitly.                                                                                                  | Must-have | ✅  | ✅  |
| R5  | The first self-hosted deployment receives Slack events without opening an inbound public HTTP endpoint.                                                           | Must-have | ✅  | ❌  |
| R6  | Slack-specific credentials stay in environment configuration; A2A credentials remain explicit per Agent and are never disclosed in Slack.                         | Must-have | ❌  | ❌  |
| R7  | Existing Discord behavior and all remote A2A protocol semantics remain unchanged.                                                                                 | Must-have | ✅  | ✅  |

**Notes:**

- A is the intended first direction because it meets the self-hosted outbound
  transport requirement.
- Both shapes remain incomplete until the flagged Slack authorization, command
  context, scopes, and configuration mechanisms are spiked.

## Spikes required before selection

| Spike                                                               | Goal                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [Slack interaction context](spike-interaction-context.md)           | Establish which Slack interaction payloads preserve a thread reference and how thread-scoped controls should work. |
| [Slack authorization and scopes](spike-authorization-and-scopes.md) | Establish the minimum scopes and reliable workspace/channel authorization signal for the shared-workspace policy.  |
