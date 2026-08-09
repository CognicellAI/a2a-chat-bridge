# Slack transport notes

Research captured 2026-08-09 from Slack's official documentation.

- [Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/) uses
  an app-level token to receive events and interactions through a WebSocket,
  without a public Events API request URL.
- [Bolt for JavaScript Socket Mode](https://docs.slack.dev/tools/bolt-js/concepts/socket-mode)
  supports a bot token plus app-level token in one Node.js process.
- [`app_mention`](https://docs.slack.dev/reference/events/app_mention/) is an
  explicit agent-ingress event and requires the `app_mentions:read` scope.
- [Message sending](https://docs.slack.dev/tools/bolt-js/concepts/message-sending/)
  supports replying in a thread using its thread timestamp.

These facts support the candidate Socket Mode shape. They do not settle the
thread-context and authorization questions recorded as spikes.
