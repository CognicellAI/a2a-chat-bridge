# 03 — Components

C4 Level 3: internals of the shipped bridge process.

```mermaid
C4Component
    title Components — a2a-chat-bridge

    Container_Boundary(discordAdapter, "Discord Adapter") {
        Component(discordGateway, "Gateway Listener", "discord.js", "Receives bot-DM and guild-thread events plus application-command interactions")
        Component(discordSurface, "Surface Router", "", "Maps bot DMs or eligible public/private threads to a Surface; mention-gates thread messages")
        Component(editor, "Edit Scheduler", "", "Batches partial text into message edits; header-driven backoff")
    }

    Container_Boundary(slackAdapter, "Slack Adapter") {
        Component(slackGateway, "Socket Mode Listener", "Slack Bolt", "Receives direct/group-direct events, mentions, slash commands, and Block Kit actions")
        Component(slackSurface, "Conversation Router", "", "Classifies direct, group-direct, channel, and thread conversations; resolves policy inheritance")
    }

    Container_Boundary(core, "A2A Client Core") {
        Component(commands, "Workspace Command Core", "", "Executes platform-neutral workspace, agent, session, and task controls")
        Component(contacts, "Contact Registry", "", "Configured Contact validation, cache, and lifecycle")
        Component(sessions, "Session Registry", "", "Archives and selects Surface ↔ contextId bindings")
        Component(tasks, "Task Record Registry", "", "Indexes bridge-initiated Tasks and refreshes known task state")
        Component(connector, "A2A Connector", "@a2a-js/sdk", "A2A calls; token provider uses local per-Agent M2M configuration")
        Component(pipe, "Stream Pipeline", "", "StreamResponse events → normalized text deltas")
    }

    System_Ext(agent, "Remote Agent", "A2A Server (opaque)")

    Rel(discordGateway, discordSurface, "events")
    Rel(discordSurface, commands, "parsed workspace command")
    Rel(slackGateway, slackSurface, "events")
    Rel(slackSurface, commands, "parsed workspace command")
    Rel(commands, sessions, "select or create Session")
    Rel(surface, sessions, "select or create Session")
    Rel(sessions, connector, "send / stream")
    Rel(connector, tasks, "record or inspect Task")
    Rel(connector, agent, "A2A v1.0", "HTTPS + SSE")
    Rel(connector, pipe, "StreamResponse events")
    Rel(pipe, editor, "text deltas")
```

## Components

| Component              | Responsibility                                                      | Key types / interfaces  | Notes                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace Command Core | Execute shared Workspace, Agent, Session, and Task command contract | typed commands/results  | Adapters parse and render; adapters create native workspace threads, while explicit direct-message and conversation policies limit agents ([ADR-0020](../decisions/0020-explicit-workspace-launch-command.md)) |
| Gateway Listener       | Discord/Slack event and interaction intake                          | discord.js / Slack Bolt | Slack classifies command conversations; Discord group DMs are unavailable to bots                                                                                                                              |
| Surface Router         | Map supported conversations to Surfaces; resolve policy inheritance | `Surface` union type    | DMs require an explicit direct-message policy; group DMs and eligible threads use conversation policy ([ADR-0019](../decisions/0019-direct-message-agent-policy.md))                                           |
| Edit Scheduler         | Batch text deltas into message edits                                | rate-limit-aware queue  | ~1 edit / 1–2s heuristic; rely on discord.js backoff                                                                                                                                                           |
| Contact Registry       | Fetch, validate, and cache configured Agent Cards                   | `AgentCard`             | Local configuration is the allowlist ([ADR-0007](../decisions/0007-hot-reloaded-local-agent-configuration.md))                                                                                                 |
| Session Registry       | Archive/select Sessions and bind them to `contextId`                | `Session` record        | A friendly local Session reference selects opaque remote context ([ADR-0008](../decisions/0008-archived-sessions-and-task-records.md))                                                                         |
| Task Record Registry   | Index bridge-initiated Tasks and refresh known status               | `TaskRecord`            | Remote A2A server remains authoritative; no arbitrary remote history discovery ([ADR-0008](../decisions/0008-archived-sessions-and-task-records.md))                                                           |
| A2A Connector          | All A2A v1.0 calls; applies each Contact's explicit auth mode       | `@a2a-js/sdk` `Client`  | OAuth tokens or static headers only when explicitly selected by that Agent ([ADR-0010](../decisions/0010-explicit-per-agent-authentication.md))                                                                |
| Stream Pipeline        | Normalize SSE events to text deltas                                 | `StreamResponse` union  | Terminal state closes the loop                                                                                                                                                                                 |
