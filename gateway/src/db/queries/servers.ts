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
  // OAuth 2.0 fields
  authType: "static" | "oauth2";
  oauthClientId: string | null;
  oauthClientSecret: string | null;
  oauthRefreshToken: string | null;
  oauthAccessToken: string | null;
  oauthTokenExpiresAt: string | null;
  oauthTokenUrl: string | null;
  oauthAuthorizeUrl: string | null;
  oauthScopes: string[] | null;
  oauthCodeVerifier: string | null;
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
    authType: (row.auth_type as "static" | "oauth2") ?? "static",
    oauthClientId: (row.oauth_client_id as string) ?? null,
    oauthClientSecret: (row.oauth_client_secret as string) ?? null,
    oauthRefreshToken: (row.oauth_refresh_token as string) ?? null,
    oauthAccessToken: (row.oauth_access_token as string) ?? null,
    oauthTokenExpiresAt: (row.oauth_token_expires_at as string) ?? null,
    oauthTokenUrl: (row.oauth_token_url as string) ?? null,
    oauthAuthorizeUrl: (row.oauth_authorize_url as string) ?? null,
    oauthScopes: (row.oauth_scopes as string[]) ?? null,
    oauthCodeVerifier: (row.oauth_code_verifier as string) ?? null,
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
    authType?: "static" | "oauth2";
    oauthClientId?: string;
    oauthClientSecret?: string;
    oauthTokenUrl?: string;
    oauthAuthorizeUrl?: string;
    oauthScopes?: string[];
  }
): Promise<McpServerRecord> {
  const insert: Record<string, unknown> = {
    tenant_id: tenantId,
    name: server.name,
    transport: server.transport,
    command: server.command ?? null,
    args: server.args ?? null,
    url: server.url ?? null,
    env: server.env ?? null,
    auth_headers: server.authHeaders ?? null,
    enabled: server.enabled ?? true,
    auth_type: server.authType ?? "static",
  };

  if (server.oauthClientId !== undefined) insert.oauth_client_id = server.oauthClientId;
  if (server.oauthClientSecret !== undefined) insert.oauth_client_secret = server.oauthClientSecret;
  if (server.oauthTokenUrl !== undefined) insert.oauth_token_url = server.oauthTokenUrl;
  if (server.oauthAuthorizeUrl !== undefined) insert.oauth_authorize_url = server.oauthAuthorizeUrl;
  if (server.oauthScopes !== undefined) insert.oauth_scopes = server.oauthScopes;

  const { data, error } = await getSupabaseClient()
    .from("mcp_servers")
    .insert(insert)
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
    authType: "static" | "oauth2";
    oauthClientId: string;
    oauthClientSecret: string;
    oauthTokenUrl: string;
    oauthAuthorizeUrl: string;
    oauthScopes: string[];
  }>
): Promise<McpServerRecord> {
  // Map camelCase to snake_case for Supabase
  const {
    authHeaders,
    authType,
    oauthClientId,
    oauthClientSecret,
    oauthTokenUrl,
    oauthAuthorizeUrl,
    oauthScopes,
    ...rest
  } = updates;
  const dbUpdates: Record<string, unknown> = {
    ...rest,
    updated_at: new Date().toISOString(),
  };
  if (authHeaders !== undefined) dbUpdates.auth_headers = authHeaders;
  if (authType !== undefined) dbUpdates.auth_type = authType;
  if (oauthClientId !== undefined) dbUpdates.oauth_client_id = oauthClientId;
  if (oauthClientSecret !== undefined) dbUpdates.oauth_client_secret = oauthClientSecret;
  if (oauthTokenUrl !== undefined) dbUpdates.oauth_token_url = oauthTokenUrl;
  if (oauthAuthorizeUrl !== undefined) dbUpdates.oauth_authorize_url = oauthAuthorizeUrl;
  if (oauthScopes !== undefined) dbUpdates.oauth_scopes = oauthScopes;

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

/**
 * Persist dynamic client registration result (client_id + optional secret).
 */
export async function updateServerOAuthClientRegistration(
  id: string,
  tenantId: string,
  info: { oauthClientId: string; oauthClientSecret?: string | null }
): Promise<void> {
  const updates: Record<string, unknown> = {
    oauth_client_id: info.oauthClientId,
    updated_at: new Date().toISOString(),
  };
  if (info.oauthClientSecret !== undefined) {
    updates.oauth_client_secret = info.oauthClientSecret;
  }
  const { error } = await getSupabaseClient()
    .from("mcp_servers")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}

/**
 * Narrow update for OAuth tokens only. Used after token exchange/refresh.
 */
export async function updateServerOAuthTokens(
  id: string,
  tenantId: string,
  tokens: {
    oauthAccessToken: string;
    oauthRefreshToken: string | null;
    oauthTokenExpiresAt: string;
  }
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("mcp_servers")
    .update({
      oauth_access_token: tokens.oauthAccessToken,
      oauth_refresh_token: tokens.oauthRefreshToken,
      oauth_token_expires_at: tokens.oauthTokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}

/**
 * Persist PKCE code verifier to survive container restarts during OAuth flow.
 */
export async function updateServerCodeVerifier(
  id: string,
  tenantId: string,
  codeVerifier: string | null
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("mcp_servers")
    .update({
      oauth_code_verifier: codeVerifier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw error;
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
