import { getSupabaseClient } from "../client.js";

export interface TeamMember {
  id: string;
  tenantId: string;
  clerkUserId: string;
  role: string;
  createdAt: string;
}

function toRecord(row: Record<string, unknown>): TeamMember {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    clerkUserId: row.clerk_user_id as string,
    role: row.role as string,
    createdAt: row.created_at as string,
  };
}

/**
 * List all team members (tenant_users) for a tenant.
 */
export async function getTeamMembers(
  tenantId: string
): Promise<TeamMember[]> {
  const { data: rows, error } = await getSupabaseClient()
    .from("tenant_users")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (rows ?? []).map(toRecord);
}

/**
 * Add a new team member to a tenant.
 */
export async function inviteTeamMember(
  tenantId: string,
  clerkUserId: string,
  role: string
): Promise<TeamMember> {
  const { data: row, error } = await getSupabaseClient()
    .from("tenant_users")
    .insert({
      tenant_id: tenantId,
      clerk_user_id: clerkUserId,
      role,
    })
    .select()
    .single();

  if (error) throw error;
  return toRecord(row);
}

/**
 * Remove a team member from a tenant.
 */
export async function removeTeamMember(
  tenantId: string,
  userId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("tenant_users")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", userId);

  if (error) throw error;
}

/**
 * Update a team member's role.
 */
export async function updateMemberRole(
  tenantId: string,
  userId: string,
  newRole: string
): Promise<TeamMember> {
  const { data: row, error } = await getSupabaseClient()
    .from("tenant_users")
    .update({ role: newRole })
    .eq("tenant_id", tenantId)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return toRecord(row);
}
