import type { M2MOAuthConfig } from "../config.js";

interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

const refreshSkewMs = 30_000;

/** Fetches and caches short-lived M2M tokens without persisting them. */
export class M2MTokenProvider {
  private readonly tokens = new Map<string, CachedToken>();

  async authorization(
    profileKey: string,
    config: M2MOAuthConfig,
  ): Promise<string> {
    const cacheKey = profileKey;
    const cached = this.tokens.get(cacheKey);
    if (cached && cached.expiresAt - refreshSkewMs > Date.now())
      return `Bearer ${cached.accessToken}`;

    const body = new URLSearchParams({ grant_type: "client_credentials" });
    if (config.scopes.length) body.set("scope", config.scopes.join(" "));
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      },
      body,
    });
    if (!response.ok)
      throw new Error(
        `OAuth token request failed: ${response.status} ${response.statusText}.`,
      );
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new Error("OAuth token response was not an object.");
    const { access_token: accessToken, expires_in: expiresIn } = payload as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof accessToken !== "string" || !accessToken)
      throw new Error("OAuth token response did not include access_token.");
    const lifetimeMs =
      typeof expiresIn === "number" &&
      Number.isFinite(expiresIn) &&
      expiresIn > 0
        ? expiresIn * 1_000
        : 60_000;
    this.tokens.set(cacheKey, {
      accessToken,
      expiresAt: Date.now() + lifetimeMs,
    });
    return `Bearer ${accessToken}`;
  }
}
