# Research: stack verification for multi-platform-bridge

- **Date**: 2026-08-08
- **Method**: every claim checked against primary sources only (official specs, official docs, package manifests, source code). URLs cited per claim.

**Summary.** The proposal's architecture is fundamentally sound against today's primary sources: A2A v1.0 (released 2026-07-22, SDK GA the same day) supports everything the bridge needs — Agent Card discovery at `/.well-known/agent-card.json`, JSON-RPC + SSE streaming, polling, and push notifications — and `@a2a-js/sdk` v1.0.1 provides a runtime-agnostic client (explicitly tested on Cloudflare Workers) covering all required operations with per-request header injection. On the Discord side, the DM-first design checks out exactly as proposed: DMs are exempt from the privileged Message Content intent, bots can open DM channels, and interactions work in DMs. The one **contradiction**: the proposal's JSON-RPC method names (`message/send`, `message/stream`, `tasks/get`) are **A2A v0.3 names** — v1.0 renamed all methods to PascalCase (`SendMessage`, `SendStreamingMessage`, `GetTask`, …). The one **unverified** item: Discord publishes no per-route number for message-edit rate limits, so the assumed "~1 edit / 1–2s" cadence cannot be confirmed from official docs (nothing contradicts it either).

## Summary table

| #   | Assumption                                                                                           | Status                                                                                                     | Source                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Agent Card well-known URI is `/.well-known/agent-card.json` in v1.0                                  | VERIFIED                                                                                                   | https://a2a-protocol.org/latest/specification/#82-discovery-mechanisms                     |
| 2   | JSON-RPC 2.0 over HTTP(S) is a core v1.0 transport binding                                           | VERIFIED                                                                                                   | https://a2a-protocol.org/latest/specification/#9-json-rpc-protocol-binding                 |
| 3   | gRPC and HTTP+JSON/REST are also standard v1.0 bindings (agents declare, clients choose)             | VERIFIED                                                                                                   | https://a2a-protocol.org/latest/specification/#52-protocol-selection-and-negotiation       |
| 4   | JSON-RPC methods are `message/send`, `message/stream`, `tasks/get`, `tasks/cancel`                   | **CONTRADICTED** — v1.0 uses PascalCase: `SendMessage`, `SendStreamingMessage`, `GetTask`, `CancelTask`, … | https://a2a-protocol.org/latest/specification/#53-method-mapping-reference                 |
| 5   | Streaming is SSE; events are Task, Message, TaskStatusUpdateEvent, TaskArtifactUpdateEvent           | VERIFIED                                                                                                   | https://a2a-protocol.org/latest/specification/#323-stream-response                         |
| 6   | TaskState enum values in v1.0                                                                        | VERIFIED (9 values, `TASK_STATE_*` proto-enum form)                                                        | https://a2a-protocol.org/latest/specification/#413-taskstate                               |
| 7   | Push notifications: client registers webhook; agent POSTs task updates to it                         | VERIFIED                                                                                                   | https://a2a-protocol.org/latest/specification/#433-push-notification-payload               |
| 8   | a2a-js current release, license, maintenance state                                                   | VERIFIED (`@a2a-js/sdk` 1.0.1, Apache-2.0, commits days old)                                               | https://github.com/a2aproject/a2a-js/releases                                              |
| 9   | a2a-js client covers card fetch, send, SSE stream, get/cancel, push config, per-request auth headers | VERIFIED                                                                                                   | https://github.com/a2aproject/a2a-js/blob/main/src/client/transports/json_rpc_transport.ts |
| 10  | a2a-js client usable outside Node (Bun/edge)                                                         | VERIFIED (workers-safe build check + Cloudflare Workers test run)                                          | https://github.com/a2aproject/a2a-js/blob/main/vitest.edge.config.ts                       |
| 11  | a2a-js exports AgentCard, Task, Message, Part, Artifact types                                        | VERIFIED                                                                                                   | https://github.com/a2aproject/a2a-js/blob/main/src/index.ts                                |
| 12  | discord.js current major is v14; requires Node ≥18                                                   | VERIFIED (14.27.0; `engines: node >=18`)                                                                   | https://registry.npmjs.org/discord.js/latest                                               |
| 13  | discord.js runs on Bun without documented blockers                                                   | VERIFIED (first-party Bun guide)                                                                           | https://bun.com/docs/guides/ecosystem/discordjs                                            |
| 14  | Message Content intent: when required; exemptions include DMs, @mentions, bot's own messages         | VERIFIED                                                                                                   | https://discord.com/developers/docs/events/gateway#message-content-intent                  |
| 15  | Bot can open DM channel and receive DM messages without the privileged intent                        | VERIFIED                                                                                                   | https://discord.com/developers/docs/resources/user#create-dm                               |
| 16  | Editing one message ~once per 1–2s is within documented limits                                       | UNVERIFIED — no per-route numbers published (by design); only global 50 rps + header-driven limits         | https://discord.com/developers/docs/topics/rate-limits                                     |
| 17  | Invalid-request limit: 10,000 per 10 min (401/403/429)                                               | VERIFIED                                                                                                   | https://discord.com/developers/docs/topics/rate-limits                                     |
| 18  | Slash commands, select menus, buttons function in DMs                                                | VERIFIED                                                                                                   | https://discord.com/developers/docs/interactions/application-commands#interaction-contexts |
| 19  | Bots can create threads and receive thread messages (intent caveats vs DMs)                          | VERIFIED                                                                                                   | https://discord.com/developers/docs/topics/threads                                         |
| 20  | `bun build --compile` produces single executables; caveats documented                                | VERIFIED                                                                                                   | https://bun.com/docs/bundler/executables                                                   |

**Totals: 18 VERIFIED · 1 CONTRADICTED · 1 UNVERIFIED**

---

## 1. A2A protocol

Primary source: A2A Protocol Specification, **latest released version 1.0.0** (page header: "Latest Released Version [`1.0.0`](https://a2a-protocol.org/v1.0.0/specification)"; previous versions 0.3.0, 0.2.6, 0.1.0). Base URL: https://a2a-protocol.org/latest/specification/

### 1.1 Agent Card well-known URI — VERIFIED

The v1.0 spec §8.2 (Discovery Mechanisms) lists "**Well-Known URI:** Accessing `https://{server_domain}/.well-known/agent-card.json`", and §14.3 registers the well-known URI suffix `agent-card.json`: "The `.well-known/agent-card.json` URI provides a standardized location for discovering an A2A agent's capabilities…".

- https://a2a-protocol.org/latest/specification/#82-discovery-mechanisms
- https://a2a-protocol.org/latest/specification/#143-well-known-uri-registration

Corroborated in the SDK: `AGENT_CARD_PATH = '.well-known/agent-card.json'` — https://github.com/a2aproject/a2a-js/blob/main/src/constants.ts

### 1.2 Transport bindings in v1.0 — VERIFIED (with nuance)

v1.0 has **three standard bindings**, specified in sibling sections: §9 JSON-RPC 2.0, §10 gRPC, §11 HTTP+JSON/REST. Per §5.2: "**Agent Declaration**: Agents **MUST** declare all supported protocols in their AgentCard. **Client Choice**: Clients **MAY** choose any protocol declared by the agent." No single binding is mandatory for every agent; cards advertise `supportedInterfaces[]` entries of `{url, protocolBinding: "JSONRPC"|"GRPC"|"HTTP+JSON", protocolVersion}` (§8.5 sample card).

- https://a2a-protocol.org/latest/specification/#5-protocol-binding-requirements-and-interoperability
- https://a2a-protocol.org/latest/specification/#9-json-rpc-protocol-binding ("The JSON-RPC protocol binding provides a simple, HTTP-based interface using JSON-RPC 2.0 for method calls and Server-Sent Events for streaming.")
- https://a2a-protocol.org/latest/specification/#10-grpc-protocol-binding
- https://a2a-protocol.org/latest/specification/#11-httpjsonrest-protocol-binding
- https://a2a-protocol.org/latest/specification/#831-supported-interfaces-declaration

Implication for the bridge: JSON-RPC-only support is a legitimate client choice, but a v1.0 agent card may declare _only_ REST or _only_ gRPC interfaces. The a2a-js `ClientFactory` already implements selection across JSON-RPC + REST (gRPC is Node-only).

### 1.3 JSON-RPC method names — CONTRADICTED

The proposal assumes `message/send`, `message/stream`, `tasks/get`, `tasks/cancel`. **Those are the A2A v0.3 method names.** The v1.0 JSON-RPC binding (§9.4) and the binding-independent method mapping (§5.3) define:

| Functionality                        | v1.0 JSON-RPC method               | v1.0 REST endpoint                                      |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------- |
| Send message                         | `SendMessage`                      | `POST /message:send`                                    |
| Send streaming message               | `SendStreamingMessage`             | `POST /message:stream`                                  |
| Get task                             | `GetTask`                          | `GET /tasks/{id}`                                       |
| List tasks                           | `ListTasks`                        | `GET /tasks`                                            |
| Cancel task                          | `CancelTask`                       | `POST /tasks/{id}:cancel`                               |
| Subscribe to task (reconnect stream) | `SubscribeToTask`                  | `POST /tasks/{id}:subscribe`                            |
| Create push config                   | `CreateTaskPushNotificationConfig` | `POST /tasks/{id}/pushNotificationConfigs`              |
| Get push config                      | `GetTaskPushNotificationConfig`    | `GET /tasks/{id}/pushNotificationConfigs/{configId}`    |
| List push configs                    | `ListTaskPushNotificationConfigs`  | `GET /tasks/{id}/pushNotificationConfigs`               |
| Delete push config                   | `DeleteTaskPushNotificationConfig` | `DELETE /tasks/{id}/pushNotificationConfigs/{configId}` |
| Get extended Agent Card              | `GetExtendedAgentCard`             | `GET /extendedAgentCard`                                |

- https://a2a-protocol.org/latest/specification/#53-method-mapping-reference
- https://a2a-protocol.org/latest/specification/#94-core-methods

The capability set the proposal needs (send, stream, get/poll, cancel, push config) all exists — only the names differ. Confirmed in SDK source, which sends `'SendMessage'`, `'SendStreamingMessage'`, `'GetTask'`, `'CancelTask'`, `'ListTasks'`, `'SubscribeToTask'`, `'CreateTaskPushNotificationConfig'`, etc. — https://github.com/a2aproject/a2a-js/blob/main/src/client/transports/json_rpc_transport.ts

Related v0.3→v1.0 naming changes the proposal also touches: TaskState values went from kebab-case (`"input-required"`) to proto-enum form (`TASK_STATE_INPUT_REQUIRED`), and the Agent Card's `url`/`preferredTransport` fields became `supportedInterfaces[]`.

### 1.4 Streaming via SSE + event types — VERIFIED

§9.4.2: "`SendStreamingMessage`… Sends a message and subscribes to real-time updates via Server-Sent Events. **Response:** HTTP 200 with `Content-Type: text/event-stream`"; each SSE `data:` line is a JSON-RPC response whose `result` is a `StreamResponse`. §3.2.3: "A `StreamResponse` MUST contain exactly one of the following: `task` (Task), `message` (Message), `statusUpdate` (TaskStatusUpdateEvent), `artifactUpdate` (TaskArtifactUpdateEvent)". §3.1.2: the stream is either **Message-only** (exactly one Message, then close) or a **Task lifecycle stream** (Task first, then zero or more status/artifact events; "The stream MUST close when the task reaches a terminal state"). Note: the JSON-RPC binding carries the type discriminator inside the JSON payload (`task`/`message`/`statusUpdate`/`artifactUpdate` keys), not in SSE `event:` fields.

- https://a2a-protocol.org/latest/specification/#942-sendstreamingmessage
- https://a2a-protocol.org/latest/specification/#323-stream-response
- https://a2a-protocol.org/latest/specification/#312-send-streaming-message
- https://a2a-protocol.org/latest/specification/#352-streaming-event-delivery (ordering MUST be preserved; multiple concurrent streams per task allowed — useful for a bridge reconnect)

### 1.5 TaskState enum — VERIFIED

§4.1.3, v1.0 values (terminal states marked):

`TASK_STATE_UNSPECIFIED`, `TASK_STATE_SUBMITTED`, `TASK_STATE_WORKING`, `TASK_STATE_COMPLETED` (terminal), `TASK_STATE_FAILED` (terminal), `TASK_STATE_CANCELED` (terminal), `TASK_STATE_INPUT_REQUIRED` (interrupted), `TASK_STATE_REJECTED` (terminal), `TASK_STATE_AUTH_REQUIRED` (interrupted).

- https://a2a-protocol.org/latest/specification/#413-taskstate

### 1.6 Push notifications — VERIFIED

§3.1.7: `CreateTaskPushNotificationConfig` "MUST establish a webhook endpoint for task update notifications. When task updates occur, the agent will send HTTP POST requests to the configured webhook URL with `StreamResponse` payloads". §4.3.3 gives the exact POST:

```
POST {webhook_url}
Authorization: {authentication_scheme} {credentials}
Content-Type: application/a2a+json
{ /* StreamResponse: one of task / message / statusUpdate / artifactUpdate */ }
```

Credentials come from `PushNotificationConfig.authentication` (AuthenticationInfo: scheme + credentials). Delivery is at-least-once ("Agents MUST attempt delivery at least once for each configured webhook"), recommended timeout 10–30s. "Regardless of the protocol binding being used by the agent, WebHook calls use plain HTTP and the JSON payloads as defined in the HTTP protocol binding" (§3.5.1). A config can also be attached inline to a send: `SendMessageRequest.configuration.taskPushNotificationConfig` ("Task id should be empty when sending this configuration in a `SendMessage` request", §3.2.2). Requires `capabilities.pushNotifications: true` in the Agent Card, else `PushNotificationNotSupportedError` (§3.3.4).

- https://a2a-protocol.org/latest/specification/#317-create-push-notification-config
- https://a2a-protocol.org/latest/specification/#43-push-notification-objects
- https://a2a-protocol.org/latest/specification/#433-push-notification-payload
- https://a2a-protocol.org/latest/specification/#66-push-notification-setup-and-usage
- https://a2a-protocol.org/latest/specification/#141-media-type-registration (`application/a2a+json`)

### 1.7 Other v1.0 facts the proposal should know (not asked, but load-bearing)

- **Clients MUST send the `A2A-Version: 1.0` header** on every request; "Agents MUST interpret empty value as 0.3 version" (§3.6.1/§3.6.2). A hand-rolled client that omits it is silently treated as a v0.3 client. https://a2a-protocol.org/latest/specification/#36-versioning
- **`SendMessage` is blocking by default in v1.0**: `SendMessageConfiguration.returnImmediately` — "If `false` (default), the operation MUST wait until the task reaches a terminal (`COMPLETED`, `FAILED`, `CANCELED`, `REJECTED`) or interrupted (`INPUT_REQUIRED`, `AUTH_REQUIRED`) state before returning." Non-blocking mode (`returnImmediately: true`) is what makes "ack immediately, then poll `GetTask`" work. https://a2a-protocol.org/latest/specification/#322-sendmessageconfiguration
- **`GetTask` is the documented polling mechanism**: "typically used for polling the status of a task initiated with Send Message, or for fetching the final state of a task after being notified via a push notification or after a stream has ended" (§3.1.3). https://a2a-protocol.org/latest/specification/#313-get-task

## 2. a2a-js SDK

Primary sources: GitHub repo https://github.com/a2aproject/a2a-js (README, package.json, src/), GitHub Releases/Commits APIs, npm registry.

### 2.1 Version, license, maintenance — VERIFIED

- Package `@a2a-js/sdk`, version **1.0.1**, license **Apache-2.0**, `engines: node >=20`. https://github.com/a2aproject/a2a-js/blob/main/package.json
- v1.0.0 GA released **2026-07-22** ("`@a2a-js/sdk` is now generally available… implementing the full A2A Protocol Specification v1.0 across all three transports"); v1.0.1 released **2026-07-28**. https://github.com/a2aproject/a2a-js/releases/tag/v1.0.0 , https://github.com/a2aproject/a2a-js/releases/tag/v1.0.1
- Maintenance: very active — commits on 2026-08-06, 2026-08-05, 2026-08-03 (Google-org `a2aproject`, committers @google.com; 364 commits, 582 stars, nightly ITK cross-SDK metrics release updated 2026-08-08). https://github.com/a2aproject/a2a-js/commits/main/
- README: "🚀 **v1.0 stable release** implementing A2A Protocol Specification v1.0"; compat table: JSON-RPC ✅ client/server, HTTP+JSON/REST ✅ client/server, gRPC ✅ (Node.js only). https://github.com/a2aproject/a2a-js#readme

### 2.2 Client-side API coverage — VERIFIED

All verified against source:

- **Agent Card fetch helper**: `ClientFactory.createFromUrl(baseUrl, path?)` — "Downloads the agent card using the configured `AgentCardResolver`… `/.well-known/agent-card.json` is used by default"; `createFromAgentCard(card)` for in-memory cards. Transport auto-selected from `supportedInterfaces` + `preferredTransports`. https://github.com/a2aproject/a2a-js/blob/main/src/client/factory.ts
- **send / stream / get / cancel / list / resubscribe / push-config CRUD**: `Client` methods `sendMessage`, `sendMessageStream` (an `AsyncGenerator<StreamResponse>` over SSE), `getTask`, `cancelTask`, `listTasks`, `resubscribeTask`, `createTaskPushNotificationConfig`, `getTaskPushNotificationConfig`, `listTaskPushNotificationConfig`, `deleteTaskPushNotificationConfig`, `getExtendedAgentCard`. https://github.com/a2aproject/a2a-js/blob/main/src/client/transports/json_rpc_transport.ts and README capability overview https://github.com/a2aproject/a2a-js#clients
- **Auth/header injection (per-request credentials)**: every client method accepts `RequestOptions` with per-call `signal`, `context`, and `serviceParameters`, which the transport merges into HTTP request headers (`headers: {...options?.serviceParameters, 'Content-Type': …}` in `_fetchRpc`). Cross-cutting `CallInterceptor` (`before`/`after` hooks) plus `createAuthenticatingFetchWithRetry` + `AuthenticationHandler` for attaching Authorization headers with 401/403 retry. Sources: https://github.com/a2aproject/a2a-js/blob/main/src/client/transports/json_rpc_transport.ts , https://github.com/a2aproject/a2a-js#client-customization
- **Streaming parser**: `parseSseStream(response)` — operates on a `fetch` `Response` via Web `ReadableStream`/`TextDecoderStream` reader APIs; exported from the package root. https://github.com/a2aproject/a2a-js/blob/main/src/sse_utils.ts

### 2.3 Runtime portability of the client — VERIFIED

Evidence that the client parts do **not** depend on Node-only APIs:

- Runtime deps of the whole package are only `jose` (pure-JS JOSE) and `uuid`; `express`, `@grpc/grpc-js`, `@bufbuild/protobuf` are **optional peer deps**. https://github.com/a2aproject/a2a-js/blob/main/package.json
- `package.json` script `test-build:workers-safe` bundles `./dist/index.js`, `./dist/client/index.js` (and core/compat entries) with esbuild **`--platform=neutral`** — i.e., CI enforces that the client entry bundles with no Node builtins. gRPC and express entries are checked separately with `--platform=node`. https://github.com/a2aproject/a2a-js/blob/main/package.json
- `vitest.edge.config.ts` runs the test suite on **Cloudflare Workers (miniflare)** via `@cloudflare/vitest-pool-workers`, excluding only Express and gRPC tests ("Express tests require Node.js-specific APIs", "gRpc test require Node.js-specific gRPC module"). Client transports (JSON-RPC + REST) are in the Workers suite. https://github.com/a2aproject/a2a-js/blob/main/vitest.edge.config.ts
- The JSON-RPC transport uses global `fetch` with an injectable `fetchImpl` fallback; README marks the compat/client subpaths "Workers-safe — no Node-only peer deps". gRPC client is a separate subpath export (`@a2a-js/sdk/client/grpc`), explicitly "Node.js only". https://github.com/a2aproject/a2a-js/blob/main/src/client/transports/json_rpc_transport.ts , https://github.com/a2aproject/a2a-js#compatibility

So the proposal's "portable, platform-agnostic core" is directly supported: use `@a2a-js/sdk/client` with the JSON-RPC/REST transports; the Node-only surface (gRPC, Express server) is isolated in separate subpaths.

### 2.4 TypeScript types exported — VERIFIED

`src/index.ts` does `export * from './types/pb/a2a.js'` (the proto-generated module containing `AgentCard`, `Task`, `Message`, `Part`, `Artifact`, `TaskStatusUpdateEvent`, `TaskArtifactUpdateEvent`, `SendMessageRequest`, …), plus `SendMessageResult = Message | Task`, constants (`AGENT_CARD_PATH`, `A2A_VERSION_HEADER`, `A2A_PROTOCOL_VERSION`), and SSE helpers. https://github.com/a2aproject/a2a-js/blob/main/src/index.ts

## 3. discord.js + Discord platform

Primary sources: https://discord.com/developers/docs/, npm registry manifests, https://github.com/discordjs/discord.js.

### 3.1 discord.js version & Node requirement; Bun compatibility — VERIFIED

- Current major: **v14**; latest published release **14.27.0** with `engines: { "node": ">=18" }`, Apache-2.0, deps include `undici ^6.27.0` and `@discordjs/ws ^1.2.3`. https://registry.npmjs.org/discord.js/latest , https://www.npmjs.com/package/discord.js
- `@discordjs/ws` 1.2.3 (the line v14 uses) depends on the **`ws ^8.17.0`** npm package (node http/net based); its 2.x line (engines node >=20, `ws ^8.18.0`) exists but is not what discord.js 14.27.0 depends on. https://registry.npmjs.org/@discordjs/ws/1.2.3
- **Bun**: Bun's official docs state "**Discord.js runs on Bun with no extra setup**" (first-party guide using `bun add discord.js`, Gateway login, slash commands). https://bun.com/docs/guides/ecosystem/discordjs
- Bun's Node-compat matrix (updated regularly, "reflects the latest version of Bun's compatibility with Node.js v23") covers what `ws`/`undici` need: `node:http` "Fully implemented" (caveat: "The outgoing client request body is buffered instead of streamed"), `node:net` fully implemented, `node:zlib` 98% of Node's test suite, `node:tls` missing only `tls.createSecurePair`, `node:http2` client implemented. https://bun.com/docs/runtime/nodejs-compat
- No first-party (discord.js repo/docs) statement prohibits Bun; discord.js issue tracker contains user reports running discord.js 14.25/14.26 under Bun 1.3.2/1.13.13 with ordinary (non-platform) bugs, e.g. https://github.com/discordjs/discord.js/issues/11359 , https://github.com/discordjs/discord.js/issues/11515
- Forward-looking note: the `main` branch package.json (next release line) already bumps to `engines: node >=24.17.0` and `undici 7.24.6`, and open PR #11539 tracks undici v8 (HTTP/2 by default). Irrelevant under the Bun runtime, but watch undici-on-Bun behavior. https://github.com/discordjs/discord.js/blob/main/packages/discord.js/package.json , https://github.com/discordjs/discord.js/pull/11539

### 3.2 Message Content privileged intent — VERIFIED (exact quotes)

Gateway docs: "`MESSAGE_CONTENT (1 << 15)` is a unique privileged intent that isn't directly associated with any Gateway events. Instead, access to `MESSAGE_CONTENT` permits your app to receive message content data across the APIs." Affected fields: "`content`, `embeds`, `attachments`, `components`, and `poll` fields in message objects".

Exemptions, verbatim: "Apps **without** the intent will receive empty values in fields that contain user-inputted content with a few exceptions:

- Content in messages that an app sends
- Content in DMs with the app
- Content in which the app is [mentioned]
- Content of the message a [message context menu command] is used on"

Approval requirements, verbatim: "[Privileged intents] require you to toggle the intent for your app in your app's settings within the Developer Portal before passing said intent. For verified apps (required for apps in 100+ guilds), the intent must also be approved after the verification process to use the intent." And: "Apps with fewer than 10,000 users can access privileged intents by enabling them in the Developer Portal." (Above that: an access-review request is required.)

- https://discord.com/developers/docs/events/gateway#message-content-intent
- https://discord.com/developers/docs/events/gateway#privileged-intents

The proposal's "free under 100 servers" is directionally right: under 100 guilds the app doesn't qualify for verification, so enabling the intent is self-serve; the docs frame the self-serve threshold as <10,000 users.

### 3.3 Open DM + receive DMs without privileged intent — VERIFIED

- "**Create DM** `POST /users/@me/channels` — Create a new DM channel with a user. Returns a DM channel object (if one already exists, it will be returned instead)." Caveat, verbatim: "If you open a significant amount of DMs too quickly, your bot may be rate limited or blocked from opening new ones." https://discord.com/developers/docs/resources/user#create-dm
- `DIRECT_MESSAGES (1 << 12)` is a **standard** (non-privileged) intent covering `MESSAGE_CREATE` / `MESSAGE_UPDATE` / `MESSAGE_DELETE` for DMs — listed in the intents table with no privileged marker. https://discord.com/developers/docs/events/gateway#gateway-intents
- DM message **content** is exempt from the MESSAGE_CONTENT intent (exemption quote in §3.2 above). https://discord.com/developers/docs/events/gateway#message-content-intent

### 3.4 Rate limits relevant to streaming UX — VERIFIED (docs) / UNVERIFIED (specific cadence)

Documented:

- "**Global Rate Limit**: All bots can make up to **50 requests per second** to our API." Interaction endpoints are exempt from this global limit.
- Per-route limits exist but are deliberately not published as numbers: "Because rate limits depend on a variety of factors and are subject to change, **rate limits should not be hard coded into your app**. Instead, your app should parse response headers" (`X-RateLimit-Limit/Remaining/Reset/Reset-After/Bucket/Scope`; buckets keyed per top-level `channel_id`, so per-DM-channel budgets are independent).
- "**Invalid Request Limit aka Cloudflare bans**… Currently, this limit is **10,000 per 10 minutes**. An invalid request is one that results in **401**, **403**, or **429** statuses." (Shared-scope 429s don't count.)
- Edit endpoint: "**Edit Message** `PATCH /channels/{channel.id}/messages/{message.id}` — Edit a previously sent message. The fields `content`, `embeds`, `flags` and `components` can be edited by the original message author." https://discord.com/developers/docs/resources/message#edit-message

- https://discord.com/developers/docs/topics/rate-limits

The proposal's assumed safe cadence ("batched ~1 edit / 1–2s") is **UNVERIFIED** as a documented figure — Discord publishes no per-route edit limit. Nothing documented contradicts it: at ~0.5–1 rps against a global 50 rps budget with per-channel bucketing and header-driven backoff (which discord.js's REST manager implements), the cadence is comfortably within documented envelopes. Treat the specific number as an empirical tuning parameter, not a documented guarantee.

### 3.5 Slash commands, select menus, buttons in DMs — VERIFIED

- Slash commands: "An individual app's **global commands are also available in DMs** if that app has a bot that shares a mutual guild with the user. Guild commands are not available in DMs." Interaction context types: "`GUILD` (`0`), `BOT_DM` (`1`), and `PRIVATE_CHANNEL` (`2`)"; "You can also include `BOT_DM` (`1`) in `contexts` when setting a global command's interaction contexts to control whether it can be run in DMs with your app." https://discord.com/developers/docs/interactions/application-commands (Registering a Command / Interaction Contexts sections)
- Buttons and select menus are **message components** attached to ordinary messages (`components` field of the message object, https://discord.com/developers/docs/resources/message#message-object); using one fires a component interaction, and interactions carry a `context` field with the same `BOT_DM` context type — i.e., component interactions are supported in DMs, with no DM restriction documented anywhere in the components/interactions docs. https://discord.com/developers/docs/components/overview (No explicit "components work in DMs" sentence exists; this is the one point resting on the interaction model rather than a verbatim statement.)

### 3.6 Threads — VERIFIED

- Bots create threads with `POST /channels/{channel.id}/threads` (Start Thread from Message / Start Thread without Message; forum/media variant). Permission bits: `CREATE_PUBLIC_THREADS`, `CREATE_PRIVATE_THREADS`, and — verbatim — "**The `SEND_MESSAGES` permission has no effect in threads; users must have `SEND_MESSAGES_IN_THREADS` to talk in a thread.**" Threads are API v9+. https://discord.com/developers/docs/topics/threads
- Receiving messages in threads: thread/message gateway events (`THREAD_CREATE` under `GUILDS`, `MESSAGE_CREATE` under `GUILD_MESSAGES`) are standard intents, but message **content** in guild threads requires the `MESSAGE_CONTENT` privileged intent unless an exemption applies (the @mention exemption is what makes the proposal's "mention-gate" design work). https://discord.com/developers/docs/events/gateway#gateway-intents , https://discord.com/developers/docs/events/gateway#message-content-intent
- Intent caveat vs DMs confirmed: DMs are exempt from MESSAGE_CONTENT; guild thread content is not. This matches the proposal's plan (DM-first; enable the intent or mention-gate when thread-follow lands).

## 4. Bun single-executable distribution

Primary source: https://bun.com/docs/bundler/executables (current docs, fetched 2026-08-08).

### 4.1 `bun build --compile` status and caveats — VERIFIED

- Supported and current: "`bun build ./cli.ts --compile --outfile mycli` … All imported files and packages are bundled into the executable, along with a copy of the Bun runtime. **All built-in Bun and Node.js APIs are supported.**" Cross-compilation documented for `bun-{linux,windows,darwin}-{x64,arm64}` (+baseline/modern/musl variants); JS API via `Bun.build({ compile: {...} })`.
- Documented caveats relevant here:
  - **Workers**: worker files must be added as extra entrypoints to be bundled ("for now you need to list the worker file as an entrypoint"). (`@discordjs/ws` can shard via worker threads — relevant if sharding is ever used.)
  - **N-API addons**: `.node` files are embeddable, but "the `.node` file must be required directly or it won't bundle correctly" (discord.js core has no native deps; `@discordjs/voice`/crypto addons would, but voice is out of scope).
  - **Config autoload**: in compiled executables, `tsconfig.json`/`package.json` loading is disabled by default, `.env`/`bunfig.toml` enabled (can be toggled).
  - `--outdir`, `--target=node`, `--no-bundle` unsupported with `--compile`.
  - **macOS**: unsigned binaries trigger Gatekeeper; codesigning with JIT entitlements documented (requires Bun ≥1.2.4).
  - x64 baseline-vs-modern: "Illegal instruction" on pre-AVX2 CPUs unless the `-baseline` target is used.
- No documented caveats specific to `ws` or `undici` in compiled mode. Bun's Node-compat page (https://bun.com/docs/runtime/nodejs-compat) covers the underlying modules; the first-party guide confirms discord.js itself runs on Bun (§3.1).

https://bun.com/docs/bundler/executables

---

## Risks and surprises

1. **CONTRADICTION — v1.0 renamed every JSON-RPC method.** The proposal's `message/send`, `message/stream`, `tasks/get`, `tasks/cancel` are **v0.3** names. v1.0 methods are `SendMessage`, `SendStreamingMessage`, `GetTask`, `ListTasks`, `CancelTask`, `SubscribeToTask`, `CreateTaskPushNotificationConfig`, etc. (spec §5.3/§9.4). Same story for TaskState (now `TASK_STATE_*` proto-enum strings) and the Agent Card (`supportedInterfaces[]` replaces v0.3 `url`/`preferredTransport`). The a2a-js SDK hides all of this behind `Client.sendMessage()` etc., so the _design_ is unaffected — but every doc/diagram in the proposal that names wire methods uses outdated spelling, and any agent ecosystem still on v0.3 is a different wire protocol. The SDK ships an **opt-in** v0.3 compat layer (`legacyCompat: { enabled: true }`); decide deliberately whether the bridge enables it.
2. **Silent v0.3 fallback.** Per spec §3.6, servers MUST treat a missing `A2A-Version` header as protocol 0.3. A hand-rolled request without the header silently speaks the old protocol. (The SDK sends `A2A-Version: 1.0` for you — one more reason to use it rather than raw fetch.)
3. **`SendMessage` blocks by default in v1.0.** The v1.0 `SendMessageConfiguration.returnImmediately` defaults to blocking-until-terminal/interrupted-state. The proposal's "`message/send` + `tasks/get` polling" fallback must explicitly set `returnImmediately: true` to get the non-blocking behavior it assumes. Streaming (`SendStreamingMessage`) is unaffected.
4. **UNVERIFIED — no documented per-route number for message edits.** The "~1 edit / 1–2s" streaming cadence is a safe-looking heuristic, not a documented limit. Discord mandates header-driven rate limiting ("rate limits should not be hard coded"); per-channel buckets mean per-DM budgets are independent; global budget is 50 rps; repeated 429s count toward a 10,000/10-min invalid-request ban. discord.js's REST manager handles the headers — rely on it, and keep the edit cadence configurable.
5. **Agent transport diversity.** "JSON-RPC is core" is true as a binding, but v1.0 agents may legitimately expose _only_ REST or _only_ gRPC interfaces. `ClientFactory` covers JSON-RPC + REST portably; gRPC clients are Node-only in the SDK (would break the "platform-agnostic core" and possibly Bun). Accept the gap or document "JSON-RPC/REST agents only".
6. **discord.js engine floor is moving.** Current release 14.27.0 requires Node ≥18, but the main branch already requires Node ≥24.17 and undici 7 (undici 8 pending in PR #11539 with HTTP/2 by default). Running under Bun sidesteps `engines`, but undici's HTTP behavior on Bun rests on Bun's `node:net`/`node:tls`/`node:http` compatibility (documented fully implemented, with the "outgoing client request body is buffered instead of streamed" caveat). The `ws` package (WebSocket client used by `@discordjs/ws`) has no first-party Bun caveat, and Bun officially guides discord.js usage — but `bun build --compile` + `ws` + `undici` together is only covered by general compatibility statements, not a dedicated guarantee. Spike this combination first.
7. **Privileged-intent math is more favorable than the proposal states, but the docs moved.** Self-serve enabling requires <10,000 users (docs current wording); verification (with intent approval) is required at 100+ guilds. For a single-tenant self-hosted bot all of this is moot — but the "free under 100 servers" rationale in the proposal should be reworded to the current thresholds.
8. **Mass-DM caution.** The Create DM endpoint warns that opening "a significant amount of DMs too quickly" can get the bot rate-limited or blocked from opening new ones. Fine for user-initiated DM-first UX; relevant if the bridge ever initiates DMs proactively (e.g., push-notification delivery into DMs).
9. **Push-notification receiving is server-side work.** a2a-js's push _sender_ and its runnable webhook-receiver sample are Express/Node-based; the bridge's own webhook endpoint (deferred past v1) can't lean on the "Workers-safe" client surface — it needs an HTTP server (Bun's `Bun.serve` or Express on Node APIs), which is a documented Bun strength but worth noting against the "no Node APIs in the core" constraint.
10. **Positive surprises the proposal doesn't account for**: (a) `SubscribeToTask` lets the bridge re-attach an SSE stream to an in-flight task after a restart — nice fit for the "soft state only" corollary; (b) multiple concurrent streams per task are explicitly permitted (§3.5.2), so a restarted bridge can re-subscribe without disrupting anything; (c) the SDK exports its SSE parser and wire helpers from the package root, so the portable core can reuse them verbatim; (d) v1.0 adds `ListTasks` and blocking/non-blocking send semantics that simplify the "rebuild mappings after restart" story.
