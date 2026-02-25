import { getSupabaseClient } from "../client.js";

export interface ToolSnapshotRecord {
  id: string;
  tenantId: string;
  serverId: string;
  toolName: string;
  definitionHash: string;
  definition: Record<string, unknown>;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getSnapshot(
  tenantId: string,
  serverId: string,
  toolName: string
): Promise<ToolSnapshotRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from("tool_snapshots")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("server_id", serverId)
    .eq("tool_name", toolName)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function getSnapshotsForServer(
  tenantId: string,
  serverId: string
): Promise<ToolSnapshotRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from("tool_snapshots")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("server_id", serverId)
    .order("tool_name");

  if (error) throw error;
  return data ?? [];
}

export async function upsertSnapshot(
  tenantId: string,
  serverId: string,
  toolName: string,
  definitionHash: string,
  definition: Record<string, unknown>
): Promise<ToolSnapshotRecord> {
  const { data, error } = await getSupabaseClient()
    .from("tool_snapshots")
    .upsert(
      {
        tenant_id: tenantId,
        server_id: serverId,
        tool_name: toolName,
        definition_hash: definitionHash,
        definition,
        approved: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,server_id,tool_name" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function approveSnapshot(
  id: string,
  tenantId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("tool_snapshots")
    .update({ approved: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}
