# 01 — System Context

C4 Level 1: a2a-chat-bridge in its environment — the user, Discord, Slack, and the
remote A2A agents it talks to. Remote agents are opaque A2A Servers, described by
what their Agent Card advertises. The operator declares Contacts in local
configuration by exact Agent Card URL; the bridge never auto-routes traffic.

```mermaid
C4Context
    title System Context — a2a-chat-bridge (v1)

    Person(user, "Chat participant", "Uses an operator-enabled private DM, supported shared direct conversation, or shared thread workspace")

    System(bridge, "a2a-chat-bridge", "Self-hosted, single-tenant A2A client. CPE — a handset, not a switchboard.")

    System_Ext(discord, "Discord", "Chat platform: bot DMs and allowlisted public/private threads")
    System_Ext(slack, "Slack", "Chat platform: DMs, allowlisted group DMs, and allowlisted channel threads")
    System_Ext(agentA, "Remote Agent A", "A2A Server (opaque) — JSON-RPC binding")
    System_Ext(agentB, "Remote Agent B", "A2A Server (opaque) — REST binding")

    Rel(user, discord, "Chats")
    Rel(discord, bridge, "Gateway events", "outbound WebSocket")
    Rel(slack, bridge, "Socket Mode events", "outbound WebSocket")
    Rel(bridge, agentA, "SendStreamingMessage, SendMessage, GetTask", "A2A v1.0 JSON-RPC over HTTPS")
    Rel(bridge, agentB, "SendStreamingMessage, SendMessage, GetTask", "A2A v1.0 REST over HTTPS")
```

Rendered SVG: [proposal diagrams](../proposal/multi-platform-bridge/diagrams/).

## Agents integrated

No static integration wiring — by design (see the proposal's Reference shape).
Configured Agent Card URLs become Contacts at runtime; the bridge fetches each
supplied URL verbatim and caches the card.

| Binding        | Interaction                                                                                    | Notes                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| JSON-RPC       | `SendStreamingMessage` primary; `SendMessage` (`returnImmediately: true`) + `GetTask` fallback | A2A v1.0 only                                                                                  |
| HTTP+JSON/REST | Same semantics, REST transport                                                                 | gRPC-only agents out of scope ([ADR-0002](../decisions/0002-typescript-with-portable-core.md)) |

## Context

a2a-chat-bridge lets a workspace owner and their invited collaborators talk to
any A2A v1.0 agent from Discord or Slack without giving any third party a position in the
traffic path. A private bot DM can be an Agent workspace only when the operator
enables the cross-adapter direct-message policy; a shared conversation requires
its parent or group-DM conversation to be allowlisted. Discord group DMs and
Slack Connect are explicitly unsupported.
Motivation and trade-offs:
[proposal](../proposal/multi-platform-bridge/README.md),
[ADR-0001](../decisions/0001-chat-bridge-as-cpe-mvp.md).
