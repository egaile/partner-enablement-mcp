/**
 * `mcpshield servers list` — show downstream MCP servers registered for
 * the default tenant. Reads from SqliteStorageBackend.servers.
 *
 * Only enabled servers are shown — these are the ones the gateway actually
 * connects to. Disabled rows are visible in mcpshield.yaml if you need them.
 */

import { SqliteStorageBackend, loadConfig } from "@mcpshield/gateway-core";
import { resolveConfigPath, resolveDbPath } from "../lib/paths.js";

export interface ServersListOptions {
  configPath?: string;
}

export async function runServersList(
  options: ServersListOptions = {}
): Promise<void> {
  const configPath = resolveConfigPath(options.configPath);
  const config = await loadConfig({ path: configPath });
  const dbPath = resolveDbPath(configPath, config.audit.path);

  const storage = new SqliteStorageBackend({ path: dbPath });
  await storage.init();
  try {
    const tenant = await storage.tenants.getOrCreateDefault();
    const servers = await storage.servers.listEnabledForTenant(tenant.id);
    if (servers.length === 0) {
      console.log("No servers registered.");
      console.log("Add one to mcpshield.yaml under `servers:` and restart.");
      return;
    }
    for (const s of servers) {
      const target =
        s.transport === "stdio"
          ? `${s.command}${s.args && s.args.length > 0 ? " " + s.args.join(" ") : ""}`
          : s.url;
      console.log(
        `${s.id}  ${s.transport.padEnd(5)}  ${s.authType.padEnd(7)}  ${s.name}`
      );
      console.log(`  target: ${target}`);
    }
  } finally {
    await storage.close();
  }
}
