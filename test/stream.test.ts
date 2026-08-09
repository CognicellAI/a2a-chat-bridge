import { describe, expect, it } from "vitest";
import { textFromMessage, textFromStreamResponse } from "../src/core/stream.js";

describe("stream pipeline", () => {
  it("renders only textual A2A parts", () => {
    const message = {
      parts: [
        { content: { $case: "text", value: "hello" } },
        { content: { $case: "data", value: { ignored: true } } },
        { content: { $case: "text", value: " world" } },
      ],
    } as never;
    expect(textFromMessage(message)).toBe("hello world");
    expect(
      textFromStreamResponse({
        payload: { $case: "message", value: message },
      } as never),
    ).toBe("hello world");
  });

  it("does not render a generic terminal status label", () => {
    expect(
      textFromStreamResponse({
        payload: {
          $case: "statusUpdate",
          value: {
            status: {
              state: 3,
              message: {
                parts: [{ content: { $case: "text", value: "Done" } }],
              },
            },
          },
        },
      } as never),
    ).toBe("");
  });
});
