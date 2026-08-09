# Architecture — a2a-chat-bridge

The canonical, living design of this app. This is the single source of truth for
how the app is designed **today** — keep it current. When a decision changes the
design, update these pages in the same change and record the _why_ as an ADR in
`../decisions/`.

Modeled with the [C4 model](https://c4model.com/), one logical page per view:

| Page                                         | C4 view        | Contents                                                                         |
| -------------------------------------------- | -------------- | -------------------------------------------------------------------------------- |
| [01-system-context.md](01-system-context.md) | System Context | The app, its users, and the remote A2A agents (A2A Servers) it integrates.       |
| [02-containers.md](02-containers.md)         | Containers     | Runnable/deployable units (UI, A2A client core, backends, stores) + protocols.   |
| [03-components.md](03-components.md)         | Components     | Internals of a container. Split into `03-components-<container>.md` as it grows. |
| [04-deployment.md](04-deployment.md)         | Deployment     | How/where containers are deployed. Optional until the app ships.                 |

## Rules

- Diagrams are Mermaid C4 fenced blocks (`C4Context`, `C4Container`, `C4Component`,
  `C4Deployment`) so they render in markdown viewers.
- Every A2A integration shown here MUST name the interaction mechanism actually
  used: request/response + polling, SSE streaming, or push notifications.
- Remote agents are always **opaque** — never draw their internals; treat each as a
  black box defined by its Agent Card.
