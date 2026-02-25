import { getSupabaseClient } from "../client.js";
import type { AuditEntry } from "../../schemas/index.js";

export async function insertAuditEntries(
  entries: AuditEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  const rows = entries.map((e) => ({
    correlation_id: e.correlationId,
    tenant_id: e.tenantId,
    user_id: e.userId ?? null,
    server_id: e.serverId,
    server_name: e.serverName,
    tool_name: e.toolName,
    policy_decision: e.policyDecision,
    policy_rule_id: e.policyRuleId ?? null,
    threats_detected: e.threatsDetected,
    threat_details: e.threatDetails ?? null,
    drift_detected: e.driftDetected,
    latency_ms: e.latencyMs,
    request_pii_detected: e.requestPiiDetected,
    response_pii_detected: e.responsePiiDetected,
    success: e.success,
    error_message: e.errorMessage ?? null,
  }));

  const { error } = await getSupabaseClient()
    .from("audit_logs")
    .insert(rows);

  if (error) throw error;
}

export async function getAuditLogs(
  tenantId: string,
  options?: {
    limit?: number;
    offset?: number;
    serverId?: string;
    toolName?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ data: Record<string, unknown>[]; count: number }> {
  let query = getSupabaseClient()
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options?.serverId) {
    query = query.eq("server_id", options.serverId);
  }
  if (options?.toolName) {
    query = query.eq("tool_name", options.toolName);
  }
  if (options?.startDate) {
    query = query.gte("created_at", options.startDate);
  }
  if (options?.endDate) {
    query = query.lte("created_at", options.endDate);
  }

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function getAuditMetrics(
  tenantId: string,
  since: string
): Promise<{
  totalCalls: number;
  blockedCalls: number;
  threatsDetected: number;
  avgLatencyMs: number;
}> {
  const { data, error } = await getSupabaseClient()
    .rpc("get_audit_metrics", {
      p_tenant_id: tenantId,
      p_since: since,
    });

  if (error) {
    // Fallback if RPC not available — do client-side aggregation
    const { data: logs } = await getSupabaseClient()
      .from("audit_logs")
      .select("policy_decision, threats_detected, latency_ms")
      .eq("tenant_id", tenantId)
      .gte("created_at", since);

    const entries = logs ?? [];
    const totalCalls = entries.length;
    const blockedCalls = entries.filter(
      (e: Record<string, unknown>) => e.policy_decision === "deny"
    ).length;
    const threatsDetected = entries.reduce(
      (sum: number, e: Record<string, unknown>) =>
        sum + ((e.threats_detected as number) ?? 0),
      0
    );
    const avgLatencyMs =
      totalCalls > 0
        ? entries.reduce(
            (sum: number, e: Record<string, unknown>) =>
              sum + ((e.latency_ms as number) ?? 0),
            0
          ) / totalCalls
        : 0;

    return { totalCalls, blockedCalls, threatsDetected, avgLatencyMs };
  }

  return data;
}
