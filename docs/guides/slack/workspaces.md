# Use Slack workspaces

[Back to the Slack adapter guide](README.md).

## 1:1 direct messages

A DM is a private Agent and Session surface only when `directMessages` is
configured. Slack's native `/a2a` command supports the complete contract there,
and ordinary text starts or continues the conversation:

```text
/a2a agent list
/a2a agent use concierge
/a2a session new concierge
Help me prepare a release
```

When exactly one agent is configured, the bridge selects it automatically.

## Group direct messages

An allowlisted group DM is a shared direct workspace. Its members share an
active agent and Session; native `/a2a` commands and ordinary text work without
creating a thread.

```text
/a2a session new researcher
Turn that into a decision.
```

## Channel and thread workspaces

In an allowlisted public or private channel, use native Slack commands to launch
a workspace:

```text
/a2a agent list
/a2a workspace start concierge Draft a release checklist
```

The bridge creates a Slack thread and posts a persistent Block Kit workspace
header showing the active agent and Session. Slack developer slash commands do
not run in threads. Inside the workspace thread, use the header or the text
command fallback for controls, and mention the bridge for normal requests:

```text
@A2ABridge Turn that into owner-assigned tasks.
@A2ABridge /a2a session current
@A2ABridge /a2a task list
```

Thread participants share the selected agent and active Session. The bridge
posts an audit update when either changes.

## Interaction rules

- Native `/a2a` supports every command in a 1:1 DM or allowlisted group DM. In
  a channel, `workspace start` launches a workspace; `agent list` previews its
  eligible Agents.
- In a configured channel thread, the bridge responds only to bot mentions;
  unrelated channel conversation is never forwarded to remote agents.
- The app must be a member of each allowlisted channel or group DM before it
  can receive events and post replies.
- Slack Connect conversations are unsupported.
- A new Session does not cancel remote Tasks from an earlier Session.

## Troubleshooting

| Symptom                       | Check                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/a2a` is missing             | Reimport the manifest or register `/a2a`, then reinstall the Slack app.                                          |
| Header buttons do nothing     | Confirm the manifest enables interactivity, Socket Mode is enabled, and the bridge log shows a Slack connection. |
| Bot ignores a channel request | Add the app to the channel, configure its ID, then mention `@A2ABridge` in its workspace thread.                 |
| Group DM is unavailable       | Add its ID under `slack.conversations`, then reinstall if scopes changed.                                        |
| Bot cannot post               | Grant the app access and verify the `chat:write` scope after reinstalling.                                       |
| Agent is unavailable          | Run `/a2a agent list`; the alias must be configured and allowed by conversation policy.                          |
