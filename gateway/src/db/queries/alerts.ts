import { getSupabaseClient } from "../client.js";
import type { AlertType, AlertSeverity } from "../../schemas/index.js";

export interface AlertRecord {
  id: string;
  tenantId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  details: Record<string, unknown>;
  serverId: string | null;
  toolName: string | null;
  correlationId: string | null;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export async function createAlert(alert: {
  tenantId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  details: Record<string, unknown>;
  serverId?: string;
  toolName?: string;
  correlationId?: string;
}): Promise<AlertRecord> {
  const { data, error } = await getSupabaseClient()
    .from("alerts")
    .insert({
      tenant_id: alert.tenantId,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      details: alert.details,
      server_id: alert.serverId ?? null,
      tool_name: alert.toolName ?? null,
      correlation_id: alert.correlationId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAlertsForTenant(
  tenantId: string,
  options?: {
    limit?: number;
    offset?: number;
    acknowledged?: boolean;
    severity?: AlertSeverity;
    type?: AlertType;
  }
): Promise<{ data: AlertRecord[]; count: number }> {
  let query = getSupabaseClient()
    .from("alerts")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options?.acknowledged !== undefined) {
    query = query.eq("acknowledged", options.acknowledged);
  }
  if (options?.severity) {
    query = query.eq("severity", options.severity);
  }
  if (options?.type) {
    query = query.eq("type", options.type);
  }

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function acknowledgeAlert(
  id: string,
  tenantId: string,
  userId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("alerts")
    .update({
      acknowledged: true,
      acknowledged_by: userId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}
