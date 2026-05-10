export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
}

interface WindowEntry {
  timestamps: number[];
}

export class RateLimiter {
  private windows = new Map<string, WindowEntry>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly windowMs = 60_000; // 60-second sliding window

  start(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanup(), this.windowMs);
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Build a rate limit key from context.
   */
  static buildKey(
    tenantId: string,
    userId: string,
    serverName: string,
    toolName: string
  ): string {
    return `${tenantId}:${userId}:${serverName}:${toolName}`;
  }

  /**
   * Check (and record) a rate-limited action.
   * Returns whether the action is allowed given maxPerMinute.
   */
  check(key: string, maxPerMinute: number): RateLimitResult {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let entry = this.windows.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.windows.set(key, entry);
    }

    // Prune expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    const current = entry.timestamps.length;

    if (current >= maxPerMinute) {
      return { allowed: false, current, limit: maxPerMinute };
    }

    // Record this call
    entry.timestamps.push(now);
    return { allowed: true, current: current + 1, limit: maxPerMinute };
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    for (const [key, entry] of this.windows.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) {
        this.windows.delete(key);
      }
    }
  }
}
