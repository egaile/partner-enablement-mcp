import { getSupabaseClient } from "../client.js";

export interface WebhookRecord {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

function toRecord(row: Record<string, unknown>): WebhookRecord {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    url: row.url as string,
    secret: row.secret as string,
    events: (row.events as string[]) ?? [],
    enabled: row.enabled as boolean,
    createdAt: row.created_at as string,
  };
}

export async function getWebhooksForTenant(
  tenantId: string
): Promise<WebhookRecord[]> {
  const { data: rows, error } = await getSupabaseClient()
    .from("webhooks")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (rows ?? []).map(toRecord);
}

export async function getWebhooksByEvent(
  tenantId: string,
  event: string
): Promise<WebhookRecord[]> {
  const { data: rows, error } = await getSupabaseClient()
    .from("webhooks")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .contains("events", [event]);

  if (error) throw error;
  return (rows ?? []).map(toRecord);
}

export async function createWebhook(
  tenantId: string,
  data: {
    url: string;
    secret: string;
    events: string[];
    enabled?: boolean;
  }
): Promise<WebhookRecord> {
  const { data: row, error } = await getSupabaseClient()
    .from("webhooks")
    .insert({
      tenant_id: tenantId,
      url: data.url,
      secret: data.secret,
      events: data.events,
      enabled: data.enabled ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return toRecord(row);
}

export async function updateWebhook(
  id: string,
  tenantId: string,
  data: Partial<{
    url: string;
    secret: string;
    events: string[];
    enabled: boolean;
  }>
): Promise<WebhookRecord> {
  const { data: row, error } = await getSupabaseClient()
    .from("webhooks")
    .update(data)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) throw error;
  return toRecord(row);
}

export async function deleteWebhook(
  id: string,
  tenantId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("webhooks")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}

export async function getWebhook(
  id: string,
  tenantId: string
): Promise<WebhookRecord | null> {
  const { data: row, error } = await getSupabaseClient()
    .from("webhooks")
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
