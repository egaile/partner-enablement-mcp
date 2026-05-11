/**
 * `mcpshield policies list` — show enabled policy rules for the default
 * tenant in priority order. Reads from SqliteStorageBackend.policies.
 *
 * Sister to `policy lint` (which validates the YAML file without touching
 * storage). This command shows what's actually loaded.
 */

import { SqliteStorageBackend, loadConfig } from "@mcpshield/gateway-core";
import { resolveConfigPath, resolveDbPath } from "../lib/paths.js";

export interface PoliciesListOptions {
  configPath?: string;
}

export async function runPoliciesList(
  options: PoliciesListOptions = {}
): Promise<void> {
  const configPath = resolveConfigPath(options.configPath);
  const config = await loadConfig({ path: configPath });
  const dbPath = resolveDbPath(configPath, config.audit.path);

  const storage = new SqliteStorageBackend({ path: dbPath });
  await storage.init();
  try {
    const tenant = await storage.tenants.getOrCreateDefault();
    const rules = await storage.policies.listEnabledForTenant(tenant.id);
    if (rules.length === 0) {
      console.log("No policies registered.");
      console.log("Add rules to mcpshield.yaml under `policies:` and restart.");
      return;
    }
    for (const r of rules) {
      const cond: string[] = [];
      if (r.conditions.servers) cond.push(`servers=${r.conditions.servers.join(",")}`);
      if (r.conditions.tools) cond.push(`tools=${r.conditions.tools.join(",")}`);
      if (r.conditions.users) cond.push(`users=${r.conditions.users.join(",")}`);
      const mods = r.modifiers
        ? Object.entries(r.modifiers)
            .filter(([, v]) => v !== undefined && v !== false)
            .map(([k, v]) => `${k}=${v}`)
        : [];
      console.log(
        `priority=${String(r.priority).padStart(4)}  ${r.action.padEnd(17)}  ${r.name}`
      );
      if (cond.length > 0) console.log(`  when: ${cond.join(", ")}`);
      if (mods.length > 0) console.log(`  with: ${mods.join(", ")}`);
    }
  } finally {
    await storage.close();
  }
}
