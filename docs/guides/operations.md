# Operations and troubleshooting

**Audience:** an operator running the bridge in development or Docker Compose.

For platform installation and workspace use, see [Discord](discord/README.md) or
[Slack](slack/README.md). For `/a2a` behavior, see the [command reference](commands.md).

## Check service health

```sh
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 bridge
```

A healthy service logs one connection line for each enabled adapter:

```text
Connected to Discord as …
Registered /a2a Discord application command.
Connected to Slack through Socket Mode.
```

Compose publishes no inbound ports and preserves local bridge metadata in its
named volume. Stop the service with `docker compose down`; the named volume
remains unless you explicitly remove it.

## Daily operator tasks

| Goal                                        | Action                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Add or change an approved agent             | Update `config.yaml` atomically; valid agent and channel-policy changes reload automatically. |
| Change token variable names or state path   | Update configuration, then restart the bridge.                                                |
| Inspect the active agent, Session, or Tasks | Use the appropriate `/a2a` command from [the command reference](commands.md).                 |
| Check an A2A failure                        | Confirm the selected agent, credentials, Agent Card, and remote-agent logs.                   |
| Recover from a stopped container            | Start Compose again; local Session and Task metadata returns from the named volume.           |

## A2A task recovery

On restart, the bridge attempts to resubscribe only to recorded in-flight A2A
Tasks. Task resubscription is optional in A2A. If a remote agent does not
support it, the bridge logs one informational summary and does not post a stale
“resuming” message into chat.

Use `/a2a task status <task>` to refresh a recorded Task directly.

## Troubleshooting

| Symptom                               | Action                                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Bridge will not start                 | Validate `config.yaml`, required token environment variables, and file access to `stateFile`.                                 |
| Agent request fails                   | Use `/a2a agent current`, then verify the exact Agent Card URL, configured auth mode, and remote-agent logs.                  |
| Context appears reset                 | Confirm that the configured `stateFile` or Docker named volume persists across restarts.                                      |
| No commands or replies on one adapter | Follow its adapter-specific checks: [Discord](discord/README.md#troubleshooting) or [Slack](slack/README.md#troubleshooting). |
| Task recovery unavailable             | The remote agent does not implement optional resubscription. Use `/a2a task status` for a direct refresh.                     |

Never paste `config.yaml`, bot tokens, app tokens, access tokens, or client
secrets into chat or logs.

## Related guides

- [Get started](getting-started.md)
- [Configuration reference](configuration.md)
- [Discord integration and usage](discord/README.md)
- [Slack integration and usage](slack/README.md)
