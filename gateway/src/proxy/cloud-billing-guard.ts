/**
 * CloudBillingGuard — adapts the cloud's `PlanCache` (which reads plan tier
 * + current usage from Supabase) to the `BillingGuard` port consumed by
 * gateway-core's tool interceptor.
 *
 * `isWithinSoftLimit` honors the 10% grace buffer defined per-plan.
 */

import type { BillingGuard } from "@mcpshield/gateway-core/proxy";
import type { PlanCache } from "../billing/plan-cache.js";
import { isWithinSoftLimit } from "../billing/plans.js";

export class CloudBillingGuard implements BillingGuard {
  constructor(private readonly cache: PlanCache) {}

  async check(
    tenantId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const { plan, usage } = await this.cache.getPlanAndUsage(tenantId);
    if (isWithinSoftLimit(usage.callCount, plan)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Usage limit exceeded (${plan.maxCallsPerMonth} calls/month on ${plan.name} plan). Please upgrade your plan or contact support.`,
    };
  }
}
