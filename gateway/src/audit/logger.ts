import { insertAuditEntries } from "../db/queries/audit.js";
import { loadConfig } from "../config.js";
import type { AuditEntry } from "../schemas/index.js";

export class AuditLogger {
  private buffer: AuditEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private batchSize: number;
  private flushIntervalMs: number;

  constructor(options?: { batchSize?: number; flushIntervalMs?: number }) {
    const config = loadConfig();
    this.batchSize = options?.batchSize ?? config.auditBatchSize;
    this.flushIntervalMs =
      options?.flushIntervalMs ?? config.auditFlushIntervalMs;
  }

  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error("[audit] Flush error:", err);
      });
    }, this.flushIntervalMs);
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  log(entry: AuditEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.batchSize) {
      this.flush().catch((err) => {
        console.error("[audit] Flush error:", err);
      });
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.batchSize);
    try {
      await insertAuditEntries(batch);
    } catch (error) {
      // Put failed entries back at the front for retry
      this.buffer.unshift(...batch);
      throw error;
    }
  }

  get pendingCount(): number {
    return this.buffer.length;
  }
}
