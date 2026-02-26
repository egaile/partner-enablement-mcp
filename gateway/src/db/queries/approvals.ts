import { getSupabaseClient } from "../client.js";

export interface ApprovalRecord {
  id: string;
  tenantId: string;
  correlationId: string;
  userId: string;
  serverName: string;
  toolName: string;
  params: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  expiresAt: string;
}

function toRecord(row: Record<string, unknown>): ApprovalRecord {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    correlationId: row.correlation_id as string,
    userId: row.user_id as string,
    serverName: row.server_name as string,
    toolName: row.tool_name as string,
    params: (row.params as Record<string, unknown>) ?? {},
    status: row.status as ApprovalRecord["status"],
    requestedAt: row.requested_at as string,
    decidedBy: (row.decided_by as string) ?? null,
    decidedAt: (row.decided_at as string) ?? null,
    expiresAt: row.expires_at as string,
  };
}

export async function createApprovalRequest(data: {
  tenantId: string;
  correlationId: string;
  userId: string;
  serverName: string;
  toolName: string;
  params: Record<string, unknown>;
}): Promise<ApprovalRecord> {
  const { data: row, error } = await getSupabaseClient()
    .from("approval_requests")
    .insert({
      tenant_id: data.tenantId,
      correlation_id: data.correlationId,
      user_id: data.userId,
      server_name: data.serverName,
      tool_name: data.toolName,
      params: data.params,
    })
    .select()
    .single();

  if (error) throw error;
  return toRecord(row);
}

export async function getApprovalRequest(
  id: string,
  tenantId: string
): Promise<ApprovalRecord | null> {
  const { data: row, error } = await getSupabaseClient()
    .from("approval_requests")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return toRecord(row);
}

export async function getPendingApprovals(
  tenantId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ data: ApprovalRecord[]; count: number }> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data: rows, error, count } = await getSupabaseClient()
    .from("approval_requests")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    data: (rows ?? []).map(toRecord),
    count: count ?? 0,
  };
}

export async function approveRequest(
  id: string,
  tenantId: string,
  decidedBy: string
): Promise<ApprovalRecord> {
  const { data: row, error } = await getSupabaseClient()
    .from("approval_requests")
    .update({
      status: "approved",
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw error;
  return toRecord(row);
}

export async function rejectRequest(
  id: string,
  tenantId: string,
  decidedBy: string
): Promise<ApprovalRecord> {
  const { data: row, error } = await getSupabaseClient()
    .from("approval_requests")
    .update({
      status: "rejected",
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw error;
  return toRecord(row);
}

export async function getApprovalByCorrelation(
  correlationId: string,
  tenantId: string
): Promise<ApprovalRecord | null> {
  const { data: row, error } = await getSupabaseClient()
    .from("approval_requests")
    .select("*")
    .eq("correlation_id", correlationId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return toRecord(row);
}
