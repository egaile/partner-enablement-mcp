import { flushUsageCounts, getCurrentUsage } from "../db/queries/billing.js";

/**
 * In-memory usage counter that batches writes to Supabase.
 * Mirrors the AuditLogger buffered-write pattern.
 */
export class UsageMeter {
  /** In-memory counters keyed by tenantId */
  private counters = new Map<string, { calls: number; blocked: number }>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushIntervalMs: number;

  constructor(options?: { flushIntervalMs?: number }) {
    this.flushIntervalMs = options?.flushIntervalMs ?? 10_000;
  }

  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error("[billing] Usage meter flush error:", err);
      });
    }, this.flushIntervalMs);
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Record a tool call. Increments the in-memory counter.
   */
  record(tenantId: string, blocked: boolean = false): void {
    const existing = this.counters.get(tenantId) ?? { calls: 0, blocked: 0 };
    existing.calls += 1;
    if (blocked) existing.blocked += 1;
    this.counters.set(tenantId, existing);
  }

  /**
   * Flush all in-memory counters to Supabase via atomic increment.
   */
  async flush(): Promise<void> {
    if (this.counters.size === 0) return;

    const batch = new Map(this.counters);
    this.counters.clear();

    const promises = Array.from(batch.entries()).map(
      ([tenantId, { calls, blocked }]) =>
        flushUsageCounts(tenantId, calls, blocked).catch((err) => {
          console.error(
            `[billing] Failed to flush usage for tenant ${tenantId}:`,
            err
          );
          // Put failed counts back
          const existing = this.counters.get(tenantId) ?? {
            calls: 0,
            blocked: 0,
          };
          existing.calls += calls;
          existing.blocked += blocked;
          this.counters.set(tenantId, existing);
        })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Get current period usage for a tenant from the database.
   */
  async getUsage(
    tenantId: string
  ): Promise<{ callCount: number; blockedCount: number }> {
    // Include unflushed in-memory counts
    const pending = this.counters.get(tenantId) ?? { calls: 0, blocked: 0 };
    const dbUsage = await getCurrentUsage(tenantId);

    return {
      callCount: dbUsage.callCount + pending.calls,
      blockedCount: dbUsage.blockedCount + pending.blocked,
    };
  }
}
