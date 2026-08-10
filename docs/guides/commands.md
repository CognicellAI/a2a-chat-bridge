# Command reference

The bridge exposes one A2A workspace contract on every adapter. The UI differs
by platform; the commands and their meaning do not.

## Concepts

| Term           | Meaning                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------ |
| **Agent**      | A configured remote A2A server, identified by its Agent Card and optional alias.                 |
| **Session**    | A bridge-local conversation reference for one agent on one chat surface.                         |
| **Context ID** | A remote-agent-generated A2A identifier that groups related Tasks in one conversation.           |
| **Task**       | A bridge-recorded unit of remote A2A work. The remote agent remains authoritative for its state. |

A direct message is private to that conversation. A shared group DM or workspace
thread has one selected agent and active Session for all its participants.
Participants may select only agents allowed by the shared conversation policy.

## Commands

| Command                              | Result                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `/a2a agent list`                    | List agents allowed on the current surface.                                                                    |
| `/a2a agent current`                 | Show the selected agent and Agent Card URL.                                                                    |
| `/a2a agent use <agent>`             | Select an allowed agent alias or bridge ID.                                                                    |
| `/a2a session new [agent] [request]` | Start a fresh Session. The optional request becomes the first A2A message when the launch surface supports it. |
| `/a2a session current`               | Show Session ID, Context ID, and timestamps.                                                                   |
| `/a2a session list`                  | List saved Sessions for the selected agent and surface.                                                        |
| `/a2a session use <session>`         | Make a saved Session active again.                                                                             |
| `/a2a task current`                  | Refresh the newest recorded Task in the active Session.                                                        |
| `/a2a task list`                     | List recorded Tasks in the active Session.                                                                     |
| `/a2a task status <task>`            | Refresh a recorded Task by remote Task ID.                                                                     |

Starting a new Session does not cancel an already-running remote Task.

## Adapter-native invocation

### Discord

Use Discord's native `/a2a` command picker in a bot DM or eligible public/private
thread. In an allowlisted parent channel, `/a2a session new` creates an A2A
workspace thread. Inside a workspace thread, mention the bot to send an ordinary
request to the selected agent.

See [Discord integration and usage](discord/README.md).

### Slack

Use the full native `/a2a` contract in a Slack DM or allowlisted group DM. In an
allowlisted channel, use `agent list` or `session new [agent] [request]` to
launch a workspace. Slack developer slash commands cannot run inside message
threads. In a workspace thread, use its Block Kit header or mention the bot:

```text
@A2ABridge Summarize the options above.
@A2ABridge /a2a task list
```

See [Slack integration and usage](slack/README.md).

## Collaboration

Discord and Slack decide who may enter and administer their supported
conversations. The bridge does not define cross-platform roles. It limits agent
choice to the shared conversation policy and posts an audit notice when someone
changes the active agent or Session.
