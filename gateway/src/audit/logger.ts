import { insertAuditEntries } from "../db/queries/audit.js";
import { loadConfig } from "../config.js";
import { enrichAtlassianMetadata, type AtlassianMetadata } from "./atlassian-enricher.js";
import type { UsageMeter } from "../billing/usage-meter.js";
import type { AuditEntry } from "../schemas/index.js";

export interface EnrichedAuditEntry extends AuditEntry {
  atlassianMetadata?: AtlassianMetadata;
}

export class AuditLogger {
  private buffer: AuditEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private batchSize: number;
  private flushIntervalMs: number;
  private usageMeter: UsageMeter | null = null;

  constructor(options?: { batchSize?: number; flushIntervalMs?: number }) {
    const config = loadConfig();
    this.batchSize = options?.batchSize ?? config.auditBatchSize;
    this.flushIntervalMs =
      options?.flushIntervalMs ?? config.auditFlushIntervalMs;
  }

  /**
   * Attach a usage meter to record billing events on each log entry.
   */
  setUsageMeter(meter: UsageMeter): void {
    this.usageMeter = meter;
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

    // Record usage for billing
    if (this.usageMeter) {
      this.usageMeter.record(entry.tenantId, !entry.success);
    }

    if (this.buffer.length >= this.batchSize) {
      this.flush().catch((err) => {
        console.error("[audit] Flush error:", err);
      });
    }
  }

  /**
   * Log with Atlassian-aware enrichment.
   * Extracts project keys, space keys, and operation types from tool params.
   */
  logEnriched(
    entry: AuditEntry,
    toolParams?: Record<string, unknown>
  ): void {
    if (toolParams) {
      const metadata = enrichAtlassianMetadata(entry.toolName, toolParams);
      // Attach Atlassian metadata to threat details for storage
      if (metadata.projectKey || metadata.spaceKey || metadata.operationType !== "unknown") {
        const enriched = {
          ...entry,
          threatDetails: {
            ...(entry.threatDetails as Record<string, unknown> ?? {}),
            atlassian: metadata,
          },
        };
        this.log(enriched);
        return;
      }
    }
    this.log(entry);
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
