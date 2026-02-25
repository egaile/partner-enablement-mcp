import { getSupabaseClient } from "../client.js";

export interface McpServerRecord {
  id: string;
  tenantId: string;
  name: string;
  transport: "stdio" | "http";
  command: string | null;
  args: string[] | null;
  url: string | null;
  env: Record<string, string> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getServersForTenant(
  tenantId: string
): Promise<McpServerRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from("mcp_servers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function getServerById(
  id: string,
  tenantId: string
): Promise<McpServerRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from("mcp_servers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function getEnabledServersForTenant(
  tenantId: string
): Promise<McpServerRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from("mcp_servers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function createServer(
  tenantId: string,
  server: {
    name: string;
    transport: "stdio" | "http";
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
    enabled?: boolean;
  }
): Promise<McpServerRecord> {
  const { data, error } = await getSupabaseClient()
    .from("mcp_servers")
    .insert({
      tenant_id: tenantId,
      name: server.name,
      transport: server.transport,
      command: server.command ?? null,
      args: server.args ?? null,
      url: server.url ?? null,
      env: server.env ?? null,
      enabled: server.enabled ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateServer(
  id: string,
  tenantId: string,
  updates: Partial<{
    name: string;
    transport: "stdio" | "http";
    command: string;
    args: string[];
    url: string;
    env: Record<string, string>;
    enabled: boolean;
  }>
): Promise<McpServerRecord> {
  const { data, error } = await getSupabaseClient()
    .from("mcp_servers")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteServer(
  id: string,
  tenantId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("mcp_servers")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}
