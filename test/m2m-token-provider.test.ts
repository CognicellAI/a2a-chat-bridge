import { describe, expect, it, vi } from "vitest";
import { M2MTokenProvider } from "../src/core/m2m-token-provider.js";

describe("M2M token provider", () => {
  it("requests a client-credentials token once and caches it until refresh time", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "token-1", expires_in: 120 }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      const provider = new M2MTokenProvider();
      const oauth = {
        tokenUrl: "https://auth.example/token",
        clientId: "client",
        clientSecret: "secret",
        scopes: ["a2a.invoke"],
      };

      await expect(
        provider.authorization("revision-1:agent", oauth),
      ).resolves.toBe("Bearer token-1");
      await expect(
        provider.authorization("revision-1:agent", oauth),
      ).resolves.toBe("Bearer token-1");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe("https://auth.example/token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
