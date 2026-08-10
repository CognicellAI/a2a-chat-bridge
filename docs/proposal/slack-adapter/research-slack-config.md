# Slack adapter configuration research

Research captured 2026-08-09 from Slack's official documentation. This is a
proposal input, not supported bridge configuration.

## Recommended first-proof shape

```yaml
slack:
  botTokenEnv: SLACK_BOT_TOKEN
  appTokenEnv: SLACK_APP_TOKEN
  channels:
    - id: C0123456789
      agents: [concierge, researcher]
      defaultAgent: concierge
```

- `SLACK_BOT_TOKEN` is the installed bot token used for `chat.postMessage` and
  `chat.update`; both require `chat:write`.
  [Slack scopes](https://docs.slack.dev/reference/scopes/chat.write/)
- `SLACK_APP_TOKEN` is a separate app-level token used to open Socket Mode's
  runtime WebSocket. Socket Mode replaces a public Events/interactivity Request
  URL, but its connections refresh and must be re-established.
  [Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/)
- Channel policy uses stable Slack conversation IDs, never channel names. It is
  a bridge-local allowlist; it does not grant the bot Slack access.

## Minimum Slack app configuration

For a bot-DM plus mention-gated shared-thread proof, the bot token needs:

```yaml
oauth_config:
  scopes:
    bot:
      - app_mentions:read # receive app_mention events in conversations the bot joined
      - im:history # receive message.im events in bot DMs
      - chat:write # post and update the bot's messages
settings:
  event_subscriptions:
    bot_events:
      - app_mention
      - message.im
  socket_mode_enabled: true
  is_hosted: false
```

`app_mention` requires a configured, installed bot user and only delivers a
mention from a conversation the app belongs to. `message.im` requires
`im:history` and identifies a direct-message event with `channel_type: "im"`.
The Socket Mode documentation shows manifests with `app_mentions:read`,
`app_mention`, and `socket_mode_enabled`.
[app_mention](https://docs.slack.dev/reference/events/app_mention/)
[message.im](https://docs.slack.dev/reference/events/message.im/)
[Socket Mode manifest example](https://docs.slack.dev/apis/events-api/using-socket-mode/)

Do **not** request `channels:history` or `groups:history` for this ingress-only
proof: those scopes permit reading public/private channel history. Add one only
if a later design genuinely needs to fetch Slack history or thread replies.
[public-channel history scope](https://docs.slack.dev/reference/scopes/channels.history/)
[private-channel history scope](https://docs.slack.dev/reference/scopes/groups.history/)

## Threads, commands, and updates

- Reply in a Slack thread by calling `chat.postMessage` with the parent
  `thread_ts`. The bot must be able to post in that conversation; for private
  channels that means membership. `chat:write.public` is only needed to post in
  all public channels without joining them, so it is not appropriate for a
  least-privilege channel-policy design.
  [chat.postMessage](https://docs.slack.dev/reference/methods/chat.postmessage)
- A streamed/batched bridge response can update its own placeholder via
  `chat.update` using its `channel` and message `ts`; the method requires
  `chat:write` and cannot update someone else's message.
  [chat.update](https://docs.slack.dev/reference/methods/chat.update/)
- Native developer slash commands need `commands`, but cannot be invoked in
  message threads. Therefore thread parity must use `@Bridge /a2a …` text (or a
  message shortcut/modal), not a native `/a2a` slash command. This removes the
  previous command-context uncertainty for the first proof.
  [slash-command limits](https://docs.slack.dev/interactivity/implementing-slash-commands/)
  [commands scope](https://docs.slack.dev/reference/scopes/commands/)
- If Block Kit controls are later added, Socket Mode carries interactive
  payloads too; Slack still requires acknowledgement of each Socket Mode
  envelope. A Socket Mode app does not use the HTTP interactivity Request URL.
  [Socket Mode interactions](https://docs.slack.dev/apis/events-api/using-socket-mode/)

## Constraints to preserve in the proposal

1. Require the bot to be invited to every configured channel. The bridge's
   `channels` list then restricts agent use further; it is not a substitute for
   Slack membership.
2. Keep shared-thread ingress mention-gated. `app_mention` delivers only
   relevant messages, which aligns with the bridge's no-implicit-routing rule.
3. Treat DMs separately from shared threads: DMs use `message.im`; a channel
   mention does not replace that event subscription.
4. Defer Slack Connect, private-channel policy, and authorization from the
   first proof. Slack's event and message APIs establish delivery/membership,
   not this project's participant-versus-mutator policy.

## Distribution constraint

Slack states that Socket Mode apps cannot currently be listed in the public
Slack Marketplace. Socket Mode remains suitable for the project's self-hosted
deployment goal; Marketplace distribution would require revisiting the HTTP
Events API option.
[Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/)
