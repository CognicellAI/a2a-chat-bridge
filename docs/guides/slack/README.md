# Slack integration and usage

**Audience:** an operator connecting a Slack workspace to the bridge through
Socket Mode.

Complete [Get started](../getting-started.md) first. Socket Mode connects Slack
to the self-hosted bridge over WebSockets, so this deployment needs no public
HTTP endpoint.

## 1. Import the app manifest

1. Open your app in [Slack API Apps](https://api.slack.com/apps).
2. Open **App Manifest** and paste the contents of
   [`app-manifest.yaml`](app-manifest.yaml).
3. Save the changes, then reinstall the app to the workspace.

The manifest configures the bot user, `/a2a`, event subscriptions, Socket Mode,
and Block Kit interactivity. It grants the bot `app_mentions:read`, `chat:write`,
`commands`, and `im:history`.

## 2. Create and store Slack tokens

Create an app-level token with the `connections:write` scope under **Basic
Information**. Copy the bot token and app token only into your local environment
or `.env` file:

```sh
export SLACK_BOT_TOKEN='replace-with-xoxb-token'
export SLACK_APP_TOKEN='replace-with-xapp-token'
```

Never add either value to `config.yaml`, commit it, or paste it into chat. If you
changed the manifest after creating tokens, reinstall the app before testing.

## 3. Configure the adapter

Add the token-variable names and allowlisted Slack channels to `config.yaml`:

```yaml
slack:
  botTokenEnv: SLACK_BOT_TOKEN
  appTokenEnv: SLACK_APP_TOKEN
  channels:
    - id: C0123456789
      agents: [concierge, researcher]
      defaultAgent: concierge
```

Use the channel ID, not the channel name. Add the bridge app to that channel in
Slack, then start the bridge. Confirm this startup log:

```text
Connected to Slack through Socket Mode.
```

## 4. Launch and use a workspace

In an allowlisted Slack channel, launch a shared workspace with native Slack
commands:

```text
/a2a agent list
/a2a session new concierge Draft a release checklist
```

The bridge creates a Slack thread and posts a persistent Block Kit workspace
header. It shows the active agent and Session and provides controls for agent
selection, Session lifecycle, and Task inspection.

Slack developer slash commands cannot run inside message threads. In the
workspace thread, mention the bridge for requests or use its text-command
fallback:

```text
@A2ABridge Turn that into owner-assigned tasks.
@A2ABridge /a2a session current
@A2ABridge /a2a task list
```

Slack DMs accept ordinary text after an agent is selected. Thread participants
share one agent and active Session. Slack channel and thread membership govern
participation; the bridge only limits selections to configured aliases and posts
an audit update when an agent or Session changes.

## Slack behavior and limits

- Native `/a2a` is a channel-level launcher: use it for `agent list` and
  `session new`.
- Use Block Kit or `@A2ABridge /a2a …` for controls inside a workspace thread.
- The bridge only responds to mentions in allowlisted Slack threads; unrelated
  channel conversation is not forwarded to remote agents.
- The app must be a member of each allowlisted channel before it can receive
  mentions and post replies.

## Troubleshooting

| Symptom                       | Check                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/a2a` is missing             | Reimport the manifest or register `/a2a`, then reinstall the Slack app.                                            |
| Header buttons do nothing     | Confirm the manifest enables interactivity, Socket Mode is enabled, and the bridge log reports a Slack connection. |
| Bot ignores a channel request | Add the app to the channel, configure that channel ID, then mention `@A2ABridge` in a thread.                      |
| Bot cannot post               | Grant the app access to the channel and verify the `chat:write` scope after reinstalling.                          |
| Agent is unavailable          | Run `/a2a agent list`; the alias must be configured and allowed by the channel policy.                             |

## Related guides

- [Command reference](../commands.md)
- [Configuration reference](../configuration.md)
- [Operations and troubleshooting](../operations.md)
