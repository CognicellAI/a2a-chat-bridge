import { describe, expect, it } from "vitest";
import {
  labelAgentReply,
  workspaceIntroduction,
} from "../src/discord/adapter.js";
import type { Contact, Session } from "../src/domain.js";

const contact: Contact = {
  id: "web-app-concierge",
  name: "Web App Concierge",
  agentCardUrl: "https://agent.example/.well-known/agent-card.json",
  description: "A concierge agent.",
  supportsStreaming: true,
  createdAt: "2026-08-09T00:00:00.000Z",
};

const session: Session = {
  id: "session-1234",
  contactId: contact.id,
  surface: { platform: "discord", kind: "thread", id: "thread-1" },
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
};

describe("labelAgentReply", () => {
  it("identifies the remote Contact on every response", () => {
    expect(labelAgentReply(contact, "Hello there.")).toBe(
      "**Web App Concierge** · A2A agent\nHello there.",
    );
  });

  it("introduces a newly active thread workspace", () => {
    expect(
      workspaceIntroduction(contact, session, "<@bridge>", "concierge"),
    ).toBe(
      "**A2A workspace**\nAgent: **Web App Concierge** (concierge)\nSession: `session-1234`\nSend requests by mentioning <@bridge>.",
    );
  });
});
