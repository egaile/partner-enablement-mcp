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
  authHeaders: Record<string, string> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function toRecord(row: Record<string, unknown>): McpServerRecord {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    transport: row.transport as "stdio" | "http",
    command: (row.command as string) ?? null,
    args: (row.args as string[]) ?? null,
    url: (row.url as string) ?? null,
    env: (row.env as Record<string, string>) ?? null,
    authHeaders: (row.auth_headers as Record<string, string>) ?? null,
    enabled: row.enabled as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
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
  return (data ?? []).map((row: Record<string, unknown>) => toRecord(row));
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
  return toRecord(data as Record<string, unknown>);
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
  return (data ?? []).map((row: Record<string, unknown>) => toRecord(row));
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
    authHeaders?: Record<string, string>;
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
      auth_headers: server.authHeaders ?? null,
      enabled: server.enabled ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return toRecord(data as Record<string, unknown>);
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
    authHeaders: Record<string, string>;
    enabled: boolean;
  }>
): Promise<McpServerRecord> {
  // Map authHeaders to snake_case for Supabase
  const { authHeaders, ...rest } = updates;
  const dbUpdates: Record<string, unknown> = {
    ...rest,
    updated_at: new Date().toISOString(),
  };
  if (authHeaders !== undefined) {
    dbUpdates.auth_headers = authHeaders;
  }

  const { data, error } = await getSupabaseClient()
    .from("mcp_servers")
    .update(dbUpdates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) throw error;
  return toRecord(data as Record<string, unknown>);
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
