# Operate the bridge

Use native Discord commands under `/a2a`. A Contact is a configured remote A2A
agent; a Session retains one remote `contextId`; a Task is bridge-recorded remote
work.

## Discord workflow

| Goal                                      | Command                                      |
| ----------------------------------------- | -------------------------------------------- |
| List or select an agent                   | `/a2a contact list`, `/a2a contact use`      |
| Show selected agent and Agent Card        | `/a2a contact current`                       |
| Start, inspect, list, or resume a Session | `/a2a session new`, `current`, `list`, `use` |
| Inspect recorded Tasks                    | `/a2a task current`, `list`, `status`        |

With one configured Contact, the bridge selects it automatically. Otherwise,
select one before sending a message. Selections are memory-only and must be made
again after restart when multiple Contacts exist.

`/a2a session new` starts a fresh remote conversation; it does not cancel
already-running Tasks. `/a2a task status` refreshes a known Task with `GetTask`.

## Shared public threads

In a public thread below a configured channel policy, mention the bot to invoke
the selected agent. `/a2a contact list` shows only that policy's Agents and
`/a2a contact use` cannot select any other Agent. The Contact, Session,
`contextId`, and Task list are shared by the thread.

When a new shared Session starts, the bridge posts an **A2A workspace** message
with the Agent, Session ID, and the bot mention to use.

- Thread starter or `Manage Threads`: select Contact; start or resume Session.
- Any participant: mention the bot; inspect Contact, Session, or Task metadata.

Root channels, private threads, and unmentioned thread messages are ignored.

## Run and check health

```sh
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 bridge
```

Healthy startup logs `Connected to Discord as …` and `Registered /a2a Discord
application command.` Compose uses no inbound ports and preserves state in its
named volume. Stop it with `docker compose down`.

## Troubleshooting

| Symptom                              | Action                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bot ignores a DM                     | Confirm a Contact is selected and send ordinary text.                                                                                                  |
| Bot ignores a thread message         | Use a configured public thread and mention the bot.                                                                                                    |
| `/a2a` missing                       | Confirm registration in logs, then reopen Discord's command picker.                                                                                    |
| Agent request fails                  | Check `/a2a contact current`, credentials, and remote-agent logs.                                                                                      |
| Task recovery unavailable on restart | The agent lacks optional task resubscription; the bridge logs one info summary, stops retrying those Tasks, and posts nothing. Use `/a2a task status`. |
| Context reset                        | Confirm `stateFile` is stable and writable.                                                                                                            |

Never paste `config.yaml`, tokens, or client secrets into chat or logs.

## More detail

- [Get started](getting-started.md)
- [Configuration reference](configuration.md)
