import { getSupabaseClient } from "../client.js";

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdBy: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function toRecord(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    keyHash: row.key_hash as string,
    keyPrefix: row.key_prefix as string,
    createdBy: row.created_by as string,
    lastUsedAt: (row.last_used_at as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Insert a new API key record.
 */
export async function createApiKeyRecord(
  tenantId: string,
  data: {
    name: string;
    keyHash: string;
    keyPrefix: string;
    createdBy: string;
    expiresAt?: string;
  }
): Promise<ApiKeyRecord> {
  const { data: row, error } = await getSupabaseClient()
    .from("api_keys")
    .insert({
      tenant_id: tenantId,
      name: data.name,
      key_hash: data.keyHash,
      key_prefix: data.keyPrefix,
      created_by: data.createdBy,
      expires_at: data.expiresAt ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return toRecord(row);
}

/**
 * List all API keys for a tenant. Does NOT return key_hash.
 */
export async function getApiKeysForTenant(
  tenantId: string
): Promise<Omit<ApiKeyRecord, "keyHash">[]> {
  const { data: rows, error } = await getSupabaseClient()
    .from("api_keys")
    .select("id, tenant_id, name, key_prefix, created_by, last_used_at, expires_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (rows ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    keyPrefix: row.key_prefix as string,
    createdBy: row.created_by as string,
    lastUsedAt: (row.last_used_at as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    createdAt: row.created_at as string,
  }));
}

/**
 * Delete an API key by ID, scoped to tenant.
 */
export async function deleteApiKey(
  id: string,
  tenantId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}

/**
 * Look up an API key by its SHA-256 hash (for verification).
 */
export async function getApiKeyByHash(
  keyHash: string
): Promise<ApiKeyRecord | null> {
  const { data: row, error } = await getSupabaseClient()
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }

  return toRecord(row);
}

/**
 * Update last_used_at timestamp for an API key.
 */
export async function updateLastUsed(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
