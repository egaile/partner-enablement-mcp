import { getSupabaseClient } from "../client.js";

export interface PolicyRuleRecord {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  priority: number;
  conditions: {
    servers?: string[];
    tools?: string[];
    users?: string[];
    timeWindows?: Array<{
      daysOfWeek?: number[];
      startHour?: number;
      endHour?: number;
    }>;
  };
  action: "allow" | "deny" | "require_approval" | "log_only";
  modifiers: {
    redactPII?: boolean;
    maxCallsPerMinute?: number;
    requireMFA?: boolean;
  } | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getPoliciesForTenant(
  tenantId: string
): Promise<PolicyRuleRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from("policy_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getAllPoliciesForTenant(
  tenantId: string
): Promise<PolicyRuleRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from("policy_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("priority", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createPolicy(
  tenantId: string,
  rule: {
    name: string;
    description?: string;
    priority?: number;
    conditions: PolicyRuleRecord["conditions"];
    action: PolicyRuleRecord["action"];
    modifiers?: PolicyRuleRecord["modifiers"];
    enabled?: boolean;
  }
): Promise<PolicyRuleRecord> {
  const { data, error } = await getSupabaseClient()
    .from("policy_rules")
    .insert({
      tenant_id: tenantId,
      name: rule.name,
      description: rule.description ?? null,
      priority: rule.priority ?? 1000,
      conditions: rule.conditions,
      action: rule.action,
      modifiers: rule.modifiers ?? null,
      enabled: rule.enabled ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePolicy(
  id: string,
  tenantId: string,
  updates: Partial<{
    name: string;
    description: string;
    priority: number;
    conditions: PolicyRuleRecord["conditions"];
    action: PolicyRuleRecord["action"];
    modifiers: PolicyRuleRecord["modifiers"];
    enabled: boolean;
  }>
): Promise<PolicyRuleRecord> {
  const { data, error } = await getSupabaseClient()
    .from("policy_rules")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePolicy(
  id: string,
  tenantId: string
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("policy_rules")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw error;
}
