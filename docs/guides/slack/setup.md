# Set up the Slack adapter

[Back to the Slack adapter guide](README.md).

## 1. Import and install the app

1. Open your app in [Slack API Apps](https://api.slack.com/apps).
2. Open **App Manifest** and paste [`app-manifest.yaml`](app-manifest.yaml).
3. Save the manifest and reinstall the app to the workspace.
4. Enable **Socket Mode** if it is not already enabled.

The manifest configures the bot, `/a2a`, event subscriptions, Socket Mode, and
Block Kit interactivity. It includes direct-message, group-DM, and
conversation-read scopes needed for supported chat types.

## 2. Create and store tokens

Create an app-level token with `connections:write` under **Basic Information**.
Keep the bot token and app token only in your local environment or `.env` file:

```sh
export SLACK_BOT_TOKEN='replace-with-xoxb-token'
export SLACK_APP_TOKEN='replace-with-xapp-token'
```

Never add tokens to `config.yaml`, commit them, or paste them into chat. Reinstall
the app after a manifest or scope change.

## 3. Configure shared conversations

1:1 DMs do not need a conversation-policy entry. Add every shared channel or
group DM to `slack.conversations`:

```yaml
slack:
  botTokenEnv: SLACK_BOT_TOKEN
  appTokenEnv: SLACK_APP_TOKEN
  conversations:
    # A public or private channel
    - id: C0123456789
      agents: [concierge, researcher]
      defaultAgent: concierge
    # A group direct message
    - id: G0123456789
      agents: [concierge, researcher]
      defaultAgent: concierge
```

The policy limits agent selection; Slack membership controls who can participate.
Invite the app to each configured channel or group DM before use.

## 4. Find a conversation ID and start

Open the intended Slack conversation in a browser. Its URL ends in the
conversation ID, such as `.../C0123456789`. Use that ID in configuration.

Start the bridge and confirm:

```text
Connected to Slack through Socket Mode.
```

Next: [use Slack workspaces](workspaces.md).
