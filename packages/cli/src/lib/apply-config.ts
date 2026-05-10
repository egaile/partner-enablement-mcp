/**
 * Maps a validated `mcpshield.yaml` config onto a StorageBackend.
 *
 * Called by `mcpshield start` after the config loads and the SQLite schema
 * is bootstrapped. Uses `replaceFromConfig` for both servers and policies so
 * removing an entry from YAML actually deletes it from storage on next boot.
 */

import type {
  McpShieldConfig,
  PolicyConfigEntry,
  ServerConfigEntry,
  StorageBackend,
  PolicyRuleUpsertInput,
  ServerUpsertInput,
} from "@mcpshield/gateway-core";

function serverFromConfig(
  entry: ServerConfigEntry,
  tenantId: string
): ServerUpsertInput {
  return {
    externalId: entry.id,
    tenantId,
    name: entry.name ?? entry.id,
    transport: entry.transport,
    command: entry.command,
    args: entry.args,
    url: entry.url,
    env: entry.env,
    authHeaders: entry.authHeaders,
    enabled: entry.enabled,
    authType: entry.auth === "oauth2" ? "oauth2" : "static",
    oauthClientId: entry.oauth?.clientId,
    oauthClientSecret: entry.oauth?.clientSecret,
    oauthTokenUrl: entry.oauth?.tokenUrl,
    oauthAuthorizeUrl: entry.oauth?.authorizeUrl,
    oauthScopes: entry.oauth?.scopes,
  };
}

function policyFromConfig(
  entry: PolicyConfigEntry,
  tenantId: string
): PolicyRuleUpsertInput {
  return {
    externalId: `${tenantId}:${entry.name}`,
    tenantId,
    name: entry.name,
    description: entry.description,
    priority: entry.priority,
    conditions: entry.conditions,
    action: entry.action,
    modifiers: entry.modifiers ?? null,
    enabled: entry.enabled,
  };
}

export interface ApplyResult {
  serversApplied: number;
  policiesApplied: number;
  tenantId: string;
}

/**
 * Apply a parsed config to the storage backend.
 *
 * Idempotent — running twice with the same config yields the same end state.
 * Removing a server/policy from YAML and re-running deletes it from storage.
 */
export async function applyConfig(
  config: McpShieldConfig,
  storage: StorageBackend
): Promise<ApplyResult> {
  const tenant = await storage.tenants.getOrCreateDefault();
  const tenantId = config.tenantId ?? tenant.id;

  const servers = config.servers.map((s) => serverFromConfig(s, tenantId));
  await storage.servers.replaceFromConfig(tenantId, servers);

  const policies = config.policies.map((p) => policyFromConfig(p, tenantId));
  await storage.policies.replaceFromConfig(tenantId, policies);

  return {
    serversApplied: servers.length,
    policiesApplied: policies.length,
    tenantId,
  };
}
