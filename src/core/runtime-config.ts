import type { Config } from "../config.js";
import { loadConfig } from "../config.js";

export interface RuntimeConfigSnapshot {
  readonly revision: number;
  readonly config: Config;
}

export class RuntimeConfig {
  private current: RuntimeConfigSnapshot;

  public constructor(
    initial: Config,
    private readonly path: string,
  ) {
    this.current = Object.freeze({ revision: 1, config: initial });
  }

  snapshot(): RuntimeConfigSnapshot {
    return this.current;
  }

  isConfigured(agentCardUrl: string): boolean {
    return this.current.config.agents.some(
      (agent) => agent.agentCardUrl === agentCardUrl,
    );
  }

  async reload(): Promise<boolean> {
    const next = await loadConfig(this.path);
    if (JSON.stringify(next) === JSON.stringify(this.current.config))
      return false;
    this.current = Object.freeze({
      revision: this.current.revision + 1,
      config: next,
    });
    return true;
  }

  startPolling(
    onReload: (snapshot: RuntimeConfigSnapshot) => Promise<void>,
  ): () => void {
    const timer = setInterval(() => {
      void this.reload()
        .then(async (changed) => {
          if (changed) await onReload(this.snapshot());
        })
        .catch((error: unknown) =>
          console.error(
            "Configuration reload failed; keeping the active configuration:",
            error,
          ),
        );
    }, this.current.config.configReloadIntervalMs);
    timer.unref();
    return () => clearInterval(timer);
  }
}
