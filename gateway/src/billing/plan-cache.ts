import { getTenantById } from "../db/queries/tenants.js";
import { getCurrentUsage } from "../db/queries/billing.js";
import { getPlan, type PlanDefinition } from "./plans.js";

interface CachedPlan {
  plan: PlanDefinition;
  usage: { callCount: number; blockedCount: number };
  cachedAt: number;
}

/**
 * Cached plan + usage lookup with configurable TTL.
 * Prevents per-request DB lookups for plan enforcement.
 */
export class PlanCache {
  private cache = new Map<string, CachedPlan>();
  private ttlMs: number;

  constructor(options?: { ttlMs?: number }) {
    this.ttlMs = options?.ttlMs ?? 60_000; // 60s default
  }

  /**
   * Get plan and current usage for a tenant.
   * Returns cached data if within TTL.
   */
  async getPlanAndUsage(
    tenantId: string
  ): Promise<{ plan: PlanDefinition; usage: { callCount: number; blockedCount: number } }> {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < this.ttlMs) {
      return { plan: cached.plan, usage: cached.usage };
    }

    const [tenant, usage] = await Promise.all([
      getTenantById(tenantId),
      getCurrentUsage(tenantId),
    ]);

    const plan = getPlan(tenant?.plan ?? "starter");

    const entry: CachedPlan = {
      plan,
      usage,
      cachedAt: Date.now(),
    };
    this.cache.set(tenantId, entry);

    return { plan, usage };
  }

  /**
   * Invalidate cache for a tenant (e.g., after plan change).
   */
  invalidate(tenantId?: string): void {
    if (tenantId) {
      this.cache.delete(tenantId);
    } else {
      this.cache.clear();
    }
  }
}
