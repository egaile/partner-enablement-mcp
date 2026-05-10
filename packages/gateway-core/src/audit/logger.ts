/**
 * BaseAuditLogger — buffered, batch-flushed audit log writer.
 *
 * Writes are accumulated in an in-memory CircularBuffer and flushed in
 * batches either when the buffer reaches `batchSize` or every
 * `flushIntervalMs`. Failed flushes prepend the failed batch back to the
 * buffer for retry.
 *
 * Storage is injected via the `audit: AuditAppendPort` port, so the same
 * logger works with SQLite (OSS) and Supabase (cloud) without changes.
 *
 * Cloud-specific concerns (Atlassian metadata enrichment, billing usage
 * metering) layer on top via subclassing — see gateway/src/audit/logger.ts.
 */

import { CircularBuffer } from "./circular-buffer.js";
import type { AuditEntry } from "../schemas/index.js";

/**
 * Minimal storage port the audit logger needs. A `StorageBackend` satisfies
 * this via its `audit` property.
 */
export interface AuditAppendPort {
  append(entries: AuditEntry[]): Promise<void>;
}

export interface BaseAuditLoggerOptions {
  audit: AuditAppendPort;
  batchSize?: number;
  flushIntervalMs?: number;
  maxBufferSize?: number;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_MAX_BUFFER_SIZE = 10_000;

export class BaseAuditLogger {
  protected readonly audit: AuditAppendPort;
  protected buffer: CircularBuffer<AuditEntry>;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  protected batchSize: number;
  protected flushIntervalMs: number;
  private lastSeenDropCount = 0;

  constructor(options: BaseAuditLoggerOptions) {
    this.audit = options.audit;
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushIntervalMs =
      options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    const maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
    this.buffer = new CircularBuffer<AuditEntry>(maxBufferSize);
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

    const currentDropped = this.buffer.dropped;
    if (currentDropped > this.lastSeenDropCount) {
      const newDrops = currentDropped - this.lastSeenDropCount;
      console.warn(
        `[audit] Buffer overflow: dropped ${newDrops} oldest entries`
      );
      this.lastSeenDropCount = currentDropped;
    }

    // Subclasses may hook in additional per-entry side effects.
    this.onLogged(entry);

    if (this.buffer.length >= this.batchSize) {
      this.flush().catch((err) => {
        console.error("[audit] Flush error:", err);
      });
    }
  }

  /**
   * Implements the `AuditRecorder` port used by the proxy.
   *
   * Base behavior ignores `toolParams`. Cloud's `AuditLogger` overrides this
   * to call its Atlassian-aware `logEnriched()` path.
   */
  record(entry: AuditEntry, _toolParams?: Record<string, unknown>): void {
    this.log(entry);
  }

  /** Hook for subclasses to observe each logged entry (e.g. usage metering). */
  protected onLogged(_entry: AuditEntry): void {
    /* default: no-op */
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.drain(this.batchSize);
    try {
      await this.audit.append(batch);
    } catch (error) {
      // Put failed entries back at the front for retry
      this.buffer.prepend(batch);
      throw error;
    }
  }

  get pendingCount(): number {
    return this.buffer.length;
  }
}
