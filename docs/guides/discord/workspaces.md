# Use Discord workspaces

[Back to the Discord adapter guide](README.md).

## Direct messages

A bot DM is a private Agent and Session surface only when `directMessages` is
configured. Use Discord's native command picker for the complete `/a2a`
contract, then send ordinary text:

```text
/a2a agent list
/a2a agent use concierge
Draft a customer onboarding workflow.
```

When exactly one agent is configured, the bridge selects it automatically.

## Shared thread workspaces

In an allowlisted parent channel, create a workspace:

```text
/a2a workspace start concierge Draft a release checklist
```

The bridge creates a thread, posts the active agent and Session, and forwards
the optional request. In the thread, `session new` starts a fresh conversation
without creating another thread. Mention the bot for ordinary requests:

```text
@A2ABridge Turn that into owner-assigned tasks.
```

Use native `/a2a` commands inside the thread to inspect or change the shared
workspace. Everyone in the thread shares the selected agent and active Session;
the bridge posts an audit update when either changes.

To use an existing private thread, add the bot to that thread first. Being able
to view its parent channel alone does not grant the bot access to a private
thread.

## Interaction rules

- The bridge ignores root-channel messages and unmentioned thread messages.
- It supports public and private threads below configured parents when the bot
  can access them.
- A new Session does not cancel remote Tasks from an earlier Session.
- Discord group DMs are unavailable to bots.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `/a2a` is missing | Confirm the command-registration log, then reopen the command picker. |
| Bot cannot create a workspace thread | Grant **Create Public Threads** and **Send Messages in Threads**. |
| Bot ignores a thread request | Use a thread below a configured parent, add the bot if it is private, and mention `@A2ABridge`. |
| Agent is unavailable | Run `/a2a agent list`; the alias must be configured and allowed by the parent channel. |
| A2A request fails | Run `/a2a agent current`, verify credentials, then inspect remote-agent logs. |
