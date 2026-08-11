# a2a-chat-bridge

A self-hosted, single-tenant Discord and Slack bridge for remote A2A v1.0
agents. It is a handset: agents are explicitly configured by exact Agent Card
URL and no agent is auto-routed or hosted by this application. It supports
private DMs, shared Slack group DMs, and shared thread workspaces below
operator-allowlisted parent channels.

Maintained by [CognicellAI](https://cognicellai.com/) and released under the
[Apache-2.0 License](LICENSE).

## Use it

Start at the [guide hub](docs/guides/README.md). It links to shared setup, the
common command reference, and adapter-native guides for
[Discord](docs/guides/discord/README.md) and
[Slack](docs/guides/slack/README.md).

## Quick start

1. Install Bun, then run `bun install`.
2. Copy `config.example.yaml` to `config.yaml` and set the state-file location.
3. Follow either the [Discord](docs/guides/discord/README.md) or
   [Slack](docs/guides/slack/README.md) guide to create and install an adapter
   app, then export its token environment variables.
4. Run `bun run dev`.

Configured agents are fetched and cached automatically. In an allowlisted
parent channel, use `/a2a workspace start` to create a workspace. In an enabled
DM, normal messages become A2A messages in the active local Session, which
retains the remote `contextId`. In an enabled thread, mention the bridge bot to
send a message to its shared agent workspace.

| Need                                      | Shared command                                  |
| ----------------------------------------- | ----------------------------------------------- |
| Select an agent                           | `/a2a agent list` and `/a2a agent use <agent>`  |
| See the selected agent and Agent Card URL | `/a2a agent current`                            |
| Start, inspect, list, or resume a Session | `/a2a session new`, `current`, `list`, or `use` |
| Inspect bridge-recorded Tasks             | `/a2a task current`, `list`, or `status`        |

The bridge streams A2A responses into batched platform message updates. Agents
without streaming capability use non-blocking `SendMessage` plus `GetTask`
polling. State is local and rebuildable; remote A2A servers remain authoritative.
See the adapter guides for platform-specific response behavior and limits.

## Build and checks

`bun run format`, `bun run typecheck`, `bun test`, and `bun run build`.

`bun run build` produces `dist/a2a-chat-bridge`. No inbound port, artifact
uploads, Slack Connect, or per-user auth are included in v0.2.0.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. Report security
issues privately as described in [SECURITY.md](SECURITY.md). Release steps are
kept in [RELEASING.md](RELEASING.md).

## Docker Compose

Docker Compose runs the bridge with no published ports and keeps its soft state
in the named `bridge-state` volume. Copy `.env.example` to `.env`, set the
token variables for the enabled adapter locally, then run:

```sh
docker compose up --build -d
docker compose logs -f bridge
```

The image includes `config.docker.yaml`, whose state file is `/data/state.json`.
For real A2A credentials, create a local `config.yaml`; Compose mounts it
read-only at `/app/config.yaml`. The bridge reloads valid atomic file updates,
so adding an Agent does not require a container recreate. Stop the bridge with
`docker compose down`. The named state volume remains unless you explicitly
remove it.
