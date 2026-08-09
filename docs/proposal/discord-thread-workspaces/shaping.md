---
shaping: true
---

# Discord thread workspaces — Shaping

## CURRENT: DM-only adapter

| Part          | Mechanism                                                                                                          | Flag |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | :--: |
| **CURRENT-1** | Accept only direct-message gateway events and `BOT_DM` `/a2a` interactions.                                        |      |
| **CURRENT-2** | Use one selected Contact in adapter memory per DM and one persisted active Session per Contact/DM Surface.         |      |
| **CURRENT-3** | Give every DM participant the same ability to select a Contact, start/resume a Session, and inspect Task metadata. |      |

## Requirements (R)

| ID  | Requirement                                                                                                                                                     | Status    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| R0  | 🟡 Human participants can collaboratively use one selected configured A2A Contact from an eligible existing Discord thread.                                     | Core goal |
| R1  | A thread exposes the same Contact, Session, and bridge-recorded Task operations that a DM exposes.                                                              | Must-have |
| R2  | Each thread keeps its selected Contact, active Session, remote `contextId`, and Task records isolated from every other Surface.                                 | Must-have |
| R3  | A thread has one visible shared agent workspace, not invisible per-user conversations interleaved in the same thread.                                           | Must-have |
| R4  | Only explicitly authorized participants can change the shared Contact or Session; permitted participants can invoke and inspect the shared agent workspace.     | Must-have |
| R5  | Unrelated thread discussion is never forwarded to the agent implicitly.                                                                                         | Must-have |
| R6  | The bridge runs without a privileged Discord Message Content intent by using an explicit mention or reply as its message ingress.                               | Must-have |
| R7  | The operator can restrict use to an allowlist of parent channels and can keep private-thread support disabled until the bot has confirmed access.               | Must-have |
| R8  | Thread support changes only the Discord adapter and local bridge state; remote A2A Contact, Session `contextId`, Task, and credential semantics stay unchanged. | Must-have |

## A: Shared workspace with gated ingress

**Selected for the proof of function.** One selected Contact and active Session
are shared by the participants in a thread. Concurrent agents are deferred.

| Part   | Mechanism                                                                                                                                                           | Flag |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| **A1** | Extend `Surface` with a Discord thread kind keyed by thread ID; reuse the existing Session and Task-record stores against that Surface.                             |      |
| **A2** | Enable Discord guild interactions and process only messages whose channel is an eligible thread under an allowlisted parent channel.                                |      |
| **A3** | Store one selected Contact per thread and reuse the active Session for that Contact/thread. Render every agent reply and Task inspection in the originating thread. |      |
| **A4** | Permit Contact and Session mutations only when the interaction author is the thread starter or has Discord's `Manage Threads` permission.                           |      |
| **A5** | Forward a thread message only when it directly mentions the bridge or replies to a bridge message; strip the leading mention before sending text to A2A.            |      |
| **A6** | Register the existing `/a2a` command in Discord's guild context and apply the same authorization checks to mutating subcommands.                                    |      |
| **A7** | Keep private threads out of scope for the first slice; reject them with a clear response rather than assuming access.                                               |      |

## B: Open shared workspace

| Part   | Mechanism                                                         | Flag |
| ------ | ----------------------------------------------------------------- | :--: |
| **B1** | Reuse A1, A2, A3, A5, A6, and A7.                                 |      |
| **B2** | Allow every thread participant to change the Contact and Session. |      |

## C: Personal Sessions in a shared thread

| Part   | Mechanism                                                                                                        | Flag |
| ------ | ---------------------------------------------------------------------------------------------------------------- | :--: |
| **C1** | Store Contact selection and active Session by thread plus Discord user ID.                                       |      |
| **C2** | Label every reply with the initiating user and route their mention/reply messages to their personal A2A context. |      |

## Fit Check

| Req | Requirement                                                                                                                                                     | Status    |  A  |  B  |  C  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | :-: | :-: | :-: |
| R0  | 🟡 Human participants can collaboratively use one selected configured A2A Contact from an eligible existing Discord thread.                                     | Core goal | ✅  | ✅  | ✅  |
| R1  | A thread exposes the same Contact, Session, and bridge-recorded Task operations that a DM exposes.                                                              | Must-have | ✅  | ✅  | ✅  |
| R2  | Each thread keeps its selected Contact, active Session, remote `contextId`, and Task records isolated from every other Surface.                                 | Must-have | ✅  | ✅  | ✅  |
| R3  | A thread has one visible shared agent workspace, not invisible per-user conversations interleaved in the same thread.                                           | Must-have | ✅  | ✅  | ❌  |
| R4  | Only explicitly authorized participants can change the shared Contact or Session; permitted participants can invoke and inspect the shared agent workspace.     | Must-have | ✅  | ❌  | ✅  |
| R5  | Unrelated thread discussion is never forwarded to the agent implicitly.                                                                                         | Must-have | ✅  | ✅  | ✅  |
| R6  | The bridge runs without a privileged Discord Message Content intent by using an explicit mention or reply as its message ingress.                               | Must-have | ✅  | ✅  | ✅  |
| R7  | The operator can restrict use to an allowlist of parent channels and can keep private-thread support disabled until the bot has confirmed access.               | Must-have | ✅  | ✅  | ✅  |
| R8  | Thread support changes only the Discord adapter and local bridge state; remote A2A Contact, Session `contextId`, Task, and credential semantics stay unchanged. | Must-have | ✅  | ✅  | ✅  |

**Notes:**

- B fails R4 because any participant can redirect or reset the shared workspace.
- C fails R3 because visible replies would share a thread while their underlying
  agent Sessions differ by user.

## Proof decisions

- One selected agent at a time; concurrent agents are deferred.
- `thread starter OR Manage Threads` mutator authorization; configured roles are
  deferred.
- Mention-only ingress; replies to bot messages are deferred.
- Contact selection remains in memory; Sessions remain persisted.
