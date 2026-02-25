import { getSupabaseClient } from "../client.js";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  defaultPolicyAction: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TenantUser {
  tenantId: string;
  clerkUserId: string;
  role: string;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const { data, error } = await getSupabaseClient()
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const { data, error } = await getSupabaseClient()
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function getTenantForUser(
  clerkUserId: string
): Promise<{ tenant: Tenant; role: string } | null> {
  const { data, error } = await getSupabaseClient()
    .from("tenant_users")
    .select("tenant_id, role, tenants(*)")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  const tenant = (data as Record<string, unknown>).tenants as Tenant;
  return { tenant, role: data.role };
}

export async function createTenant(
  name: string,
  slug: string,
  clerkUserId: string
): Promise<Tenant> {
  const db = getSupabaseClient();

  const { data: tenant, error: tenantErr } = await db
    .from("tenants")
    .insert({ name, slug })
    .select()
    .single();

  if (tenantErr) throw tenantErr;

  const { error: userErr } = await db.from("tenant_users").insert({
    tenant_id: tenant.id,
    clerk_user_id: clerkUserId,
    role: "owner",
  });

  if (userErr) throw userErr;

  return tenant;
}
