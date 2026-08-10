# Set up the Discord adapter

[Back to the Discord adapter guide](README.md).

## 1. Create and install the Discord app

1. Create an application and bot in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Install it in the server where it will be used. Include the `bot` and
   `applications.commands` installation scopes.
3. Grant the bot these permissions in every workspace parent channel:
   **View Channel**, **Send Messages**, **Create Public Threads**, **Create
   Private Threads** when used, and **Send Messages in Threads**.

The bridge does not require Discord's privileged Message Content intent. It
registers `/a2a` at startup.

## 2. Configure the bridge

Add the token-variable name to `config.yaml`. Add a parent channel only when
you want shared thread workspaces.

```yaml
discord:
  tokenEnv: DISCORD_BOT_TOKEN
  channels:
    - id: 123456789012345678
      agents: [concierge, researcher]
      defaultAgent: concierge
```

The `agents` list is the approved remote-agent selection for every workspace
thread under that parent. The bridge does not add a Discord role system;
Discord server, channel, and thread permissions determine participation.

## 3. Find the parent channel ID

In Discord, enable **Developer Mode** in **User Settings → Advanced**. Then
right-click the intended parent text channel and select **Copy Channel ID**.
Use that numeric value for `discord.channels[].id`.

## 4. Provide the bot token and start

Copy the bot token only into your local environment or `.env` file:

```sh
export DISCORD_BOT_TOKEN='replace-with-discord-token'
bun run dev
```

Confirm startup logs include:

```text
Connected to Discord as …
Registered /a2a Discord application command.
```

Reopen Discord's command picker if `/a2a` is not immediately visible after a
new installation. Restart the bridge after changing `tokenEnv`; valid
channel-policy changes are hot-reloaded.

Next: [use Discord workspaces](workspaces.md).
