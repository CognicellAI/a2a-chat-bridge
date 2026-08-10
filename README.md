# a2a-chat-bridge

A self-hosted, single-tenant Discord client for remote A2A v1.0 agents. It is a
handset: Contacts are explicitly configured by exact Agent Card URL and no agent
is auto-routed or hosted by this application. It supports DMs and shared public
thread workspaces below operator-allowlisted parent channels. It also supports
Slack DMs and mention-gated, allowlisted Slack threads through Socket Mode.

Maintained by [CognicellAI](https://cognicellai.com/) and released under the
[Apache-2.0 License](LICENSE).

## Use it

Start with the [Get started guide](docs/guides/getting-started.md). For Contact
switching, credentials, compiled operation, and troubleshooting, use the
[operations guide](docs/guides/operations.md). For the YAML schema and reload
semantics, use the [configuration reference](docs/guides/configuration.md).

## Quick start

1. Install Bun, then run `bun install`.
2. Copy `config.example.yaml` to `config.yaml` and set the state-file location.
3. Create a Discord application/bot, install it in a test server and export
   its token:
   `export DISCORD_BOT_TOKEN=...`.
4. Run `bun run dev`.

Configured Contacts are fetched and cached automatically. Use native Discord
commands under `/a2a contact` when more than one Contact exists. Normal DM
messages become A2A messages in the active local Session, which retains the
remote `contextId`. In an enabled public thread, mention the bot to send a
message to its shared agent workspace.

| Need                                      | Native Discord command                          |
| ----------------------------------------- | ----------------------------------------------- |
| Select an agent                           | `/a2a contact list` and `/a2a contact use`      |
| See the selected agent and Agent Card URL | `/a2a contact current`                          |
| Start, inspect, list, or resume a Session | `/a2a session new`, `current`, `list`, or `use` |
| Inspect bridge-recorded Tasks             | `/a2a task current`, `list`, or `status`        |

The bridge streams A2A responses into batched Discord message edits. Contacts
without streaming capability use non-blocking `SendMessage` plus `GetTask`
polling. State is local and rebuildable; remote A2A servers remain authoritative.
Responses are currently rendered into one Discord message and therefore limited
to 2,000 characters.

## Build and checks

`bun run format`, `bun run typecheck`, `bun test`, and `bun run build`.

`bun run build` produces `dist/a2a-chat-bridge`. No inbound port, webhooks,
artifact uploads, private-channel support, Slack Connect, or per-user auth are
included in v1.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. Report security
issues privately as described in [SECURITY.md](SECURITY.md). Release steps are
kept in [RELEASING.md](RELEASING.md).

## Docker Compose

Docker Compose runs the bridge with no published ports and keeps its soft state
in the named `bridge-state` volume. Copy `.env.example` to `.env`, set
`DISCORD_BOT_TOKEN` locally, then run:

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
