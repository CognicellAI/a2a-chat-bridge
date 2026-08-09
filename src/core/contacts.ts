import { ClientFactory } from "@a2a-js/sdk/client";
import type { Contact } from "../domain.js";
import type { StateStore } from "./ports.js";

const contactIdFor = (url: string) =>
  `contact-${new URL(url).host.replaceAll(".", "-")}`;

export class ContactRegistry {
  public constructor(private readonly state: StateStore) {}

  async add(agentCardUrl: string): Promise<Contact> {
    const normalizedUrl = new URL(agentCardUrl).toString();
    const factory = new ClientFactory(); // v1 defaults; legacyCompat is intentionally absent.
    // Agent Card URLs are opaque input. An empty path instructs the SDK to
    // fetch this exact URL rather than derive a conventional discovery path.
    const client = await factory.createFromUrl(normalizedUrl, "");
    if (client.protocolVersion !== "1.0") {
      throw new Error(
        `Only A2A v1.0 agents are supported (received ${client.protocolVersion}).`,
      );
    }
    const card = await client.getAgentCard();
    const contact: Contact = {
      id: contactIdFor(normalizedUrl),
      agentCardUrl: normalizedUrl,
      name: card.name || new URL(normalizedUrl).host,
      description: card.description || "",
      supportsStreaming: Boolean(card.capabilities?.streaming),
      createdAt: new Date().toISOString(),
    };
    await this.state.saveContact(contact);
    return contact;
  }

  async sync(agentCardUrls: readonly string[]): Promise<void> {
    for (const agentCardUrl of agentCardUrls) {
      const id = contactIdFor(new URL(agentCardUrl).toString());
      if (await this.state.getContact(id)) continue;
      try {
        await this.add(agentCardUrl);
      } catch (error) {
        console.error(`Could not configure Contact ${agentCardUrl}:`, error);
      }
    }
  }
}
