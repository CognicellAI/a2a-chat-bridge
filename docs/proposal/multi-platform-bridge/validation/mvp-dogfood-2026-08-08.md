# MVP dogfood validation — 2026-08-08

- **Status**: validated
- **Proposal**: [Multi-platform A2A chat bridge](../README.md)
- **Scope**: one self-hosted, single-tenant deployment; a Discord direct message; and one remote A2A agent
- **Purpose**: record runtime validation evidence. This does not change an architectural decision or require a new ADR.

## Outcome

The initial MVP successfully connected a user-installed Discord app to an authenticated, streaming A2A agent. A user added an Agent Card as a contact, selected it in a direct message, sent an ordinary chat message, and received the remote agent's streamed response as an edited Discord reply.

## Validated scenario

| Area              | Validated behavior                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment        | The bridge ran with Docker Compose, persisted state in its named volume, and did not expose an inbound application port.                |
| Discord           | A user-installed Discord app was available in a direct message and accepted bridge commands plus ordinary text.                         |
| Agent discovery   | The exact Agent Card URL supplied by the user was fetched and saved as a contact. The bridge did not append or rewrite discovery paths. |
| Contact selection | Adding the contact selected it for the direct message.                                                                                  |
| A2A transport     | The selected contact was invoked through A2A JSON-RPC streaming (`SendStreamingMessage`).                                               |
| OAuth             | The remote agent's OAuth 2.0 client-credentials requirement was met with a short-lived bearer token.                                    |
| Stream rendering  | The remote agent's response was delivered incrementally through one Discord reply that was edited as the stream progressed.             |

## Evidence

1. The Web App Concierge Agent Card was added as a contact and automatically selected for the Discord direct message.
2. An initial invocation without valid authorization was rejected with `403 Forbidden`, confirming that the remote endpoint enforced authorization.
3. After obtaining a client-credentials access token, a `Hello!` message received a complete response from Web App Concierge in the Discord conversation.
4. The response was streamed through an edited Discord message rather than posted as a sequence of partial replies.
5. The bridge preserved contact state after its Compose service was recreated.
6. An automated stream-rendering test covers suppression of generic terminal task labels such as `Done`, so those protocol-status labels are not appended to user-facing response text.

## Scope limits

This validation covered a direct-message happy path for one agent. It did not validate server-channel behavior, multi-agent switching in a single conversation, attachments or artifacts, push notifications, automatic token renewal, or recovery for every A2A server capability combination.

## Follow-ups

1. Add automatic OAuth token acquisition and renewal so short-lived client-credentials tokens do not require a manual configuration update.
2. Improve capability-aware task recovery so an agent that does not support task subscription does not generate a misleading recovery error after restart.
3. Streamline the Discord control plane: guided contact addition, clearer selected-agent status, contact details, and credential configuration outside chat commands.
4. Validate the multi-agent selection and switch flow with at least two independently authenticated contacts.
