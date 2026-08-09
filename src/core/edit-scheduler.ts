import type { ReplySink } from "./ports.js";

export class EditScheduler {
  private rendered = "";
  private pending = "";
  private timer?: ReturnType<typeof setTimeout>;

  public constructor(
    private readonly sink: ReplySink,
    private readonly intervalMs: number,
  ) {}

  append(text: string): void {
    if (!text) return;
    this.pending += text;
    if (!this.timer)
      this.timer = setTimeout(() => void this.flush(), this.intervalMs);
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.pending) return;
    this.rendered += this.pending;
    this.pending = "";
    await this.sink.update(this.rendered || "…");
  }
}
