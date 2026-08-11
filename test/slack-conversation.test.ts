import { describe, expect, it } from "vitest";
import { slackConversationKind } from "../src/slack/adapter.js";

describe("Slack conversation classification", () => {
  it.each([
    [{ is_im: true }, "dm"],
    [{ is_mpim: true }, "group-dm"],
    [{ is_channel: true }, "channel"],
    [{ is_group: true }, "channel"],
    [{}, undefined],
  ] as const)("classifies %o as %s", (conversation, expected) => {
    expect(slackConversationKind(conversation)).toBe(expected);
  });
});
