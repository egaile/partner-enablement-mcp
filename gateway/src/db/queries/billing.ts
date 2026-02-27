import { getSupabaseClient } from "../client.js";

/**
 * Flush in-memory usage counts to Supabase via the atomic increment function.
 */
export async function flushUsageCounts(
  tenantId: string,
  calls: number,
  blocked: number
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("increment_usage", {
    p_tenant_id: tenantId,
    p_calls: calls,
    p_blocked: blocked,
  });

  if (error) throw error;
}

/**
 * Get current billing period usage for a tenant.
 */
export async function getCurrentUsage(
  tenantId: string
): Promise<{ callCount: number; blockedCount: number }> {
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const { data, error } = await getSupabaseClient()
    .from("usage_meters")
    .select("call_count, blocked_count")
    .eq("tenant_id", tenantId)
    .gte("period_start", periodStart.toISOString())
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    callCount: data?.call_count ?? 0,
    blockedCount: data?.blocked_count ?? 0,
  };
}

/**
 * Get usage history for a tenant (last N months).
 */
export async function getUsageHistory(
  tenantId: string,
  months: number = 6
): Promise<
  Array<{
    periodStart: string;
    periodEnd: string;
    callCount: number;
    blockedCount: number;
  }>
> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await getSupabaseClient()
    .from("usage_meters")
    .select("period_start, period_end, call_count, blocked_count")
    .eq("tenant_id", tenantId)
    .gte("period_start", since.toISOString())
    .order("period_start", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    periodStart: row.period_start,
    periodEnd: row.period_end,
    callCount: row.call_count,
    blockedCount: row.blocked_count,
  }));
}

/**
 * Update tenant plan in the database.
 */
export async function updateTenantPlan(
  tenantId: string,
  plan: string,
  planLimits: Record<string, number>,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    plan,
    plan_limits: planLimits,
    updated_at: new Date().toISOString(),
  };

  if (stripeCustomerId !== undefined) {
    updates.stripe_customer_id = stripeCustomerId;
  }
  if (stripeSubscriptionId !== undefined) {
    updates.stripe_subscription_id = stripeSubscriptionId;
  }

  const { error } = await getSupabaseClient()
    .from("tenants")
    .update(updates)
    .eq("id", tenantId);

  if (error) throw error;
}

/**
 * Get tenant's Stripe customer ID.
 */
export async function getStripeCustomerId(
  tenantId: string
): Promise<string | null> {
  const { data, error } = await getSupabaseClient()
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", tenantId)
    .single();

  if (error) throw error;
  return data?.stripe_customer_id ?? null;
}

/**
 * Set tenant's Stripe customer ID.
 */
export async function setStripeCustomerId(
  tenantId: string,
  stripeCustomerId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("tenants")
    .update({
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (error) throw error;
}

/**
 * Find tenant by Stripe customer ID.
 */
export async function getTenantByStripeCustomerId(
  stripeCustomerId: string
): Promise<{ id: string; plan: string } | null> {
  const { data, error } = await getSupabaseClient()
    .from("tenants")
    .select("id, plan")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Get server count for a tenant.
 */
export async function getServerCount(tenantId: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("mcp_servers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (error) throw error;
  return count ?? 0;
}
