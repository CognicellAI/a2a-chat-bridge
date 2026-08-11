# 04 — Deployment

v1 deployment: one self-hosted instance per workspace, operated by the workspace
owner ([ADR-0001](../decisions/0001-chat-bridge-as-cpe-mvp.md)). All connections
are **outbound-only** — no public endpoint, no inbound ports.

```mermaid
C4Deployment
    title Deployment — a2a-chat-bridge (v1)

    Deployment_Node(host, "Self-hosted machine", "user's hardware or VPS — outbound-only") {
        Container(app, "a2a-chat-bridge", "Bun single executable", "Discord and Slack adapters + A2A client core")
        ContainerDb(state, "Soft state + config", "filesystem", "JSON; YAML/env")
    }

    Deployment_Node(discordCloud, "Discord", "SaaS") {
        System_Ext(discord, "Discord Gateway / API")
    }

    Deployment_Node(slackCloud, "Slack", "SaaS") {
        System_Ext(slack, "Slack Socket Mode / API")
    }

    Deployment_Node(agentHosts, "Agent hosts", "third parties") {
        System_Ext(agents, "A2A Servers (opaque)")
    }

    Rel(app, discord, "Gateway WebSocket + REST", "outbound")
    Rel(app, slack, "Socket Mode WebSocket + Web API", "outbound")
    Rel(app, agents, "A2A v1.0 over HTTPS", "outbound")
```

## Environments

| Environment | Purpose                              | URL / location | Notes                 |
| ----------- | ------------------------------------ | -------------- | --------------------- |
| local       | Dogfooding — the only v1 environment | user's machine | Single Bun executable |

## Notes

- No inbound networking is required. A2A push notifications are not implemented;
  a future proposal must decide how a webhook endpoint is reachable, for example
  through a small VPS or a tunnel.
- The machine needs outbound HTTPS and WebSocket access to the enabled chat
  platform(s) and to whatever hosts the dialed A2A agents. Discord uses its
  Gateway; Slack uses Socket Mode, so neither adapter requires an inbound
  request URL.
