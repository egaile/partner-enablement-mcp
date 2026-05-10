/**
 * `mcpshield key create [--name <name>]` — mint a new API key for the
 * default self-host tenant. Prints the raw key once (and only once); after
 * that only the hash is recoverable from the DB.
 *
 * Use the printed key as `Authorization: Bearer <key>` against `/mcp`.
 */

import {
  SqliteStorageBackend,
  generateApiKey,
  loadConfig,
} from "@mcpshield/gateway-core";
import { resolveConfigPath, resolveDbPath } from "../lib/paths.js";

export interface KeyCreateOptions {
  configPath?: string;
  name?: string;
}

export async function runKeyCreate(
  options: KeyCreateOptions = {}
): Promise<void> {
  const configPath = resolveConfigPath(options.configPath);
  const config = await loadConfig({ path: configPath });
  const dbPath = resolveDbPath(configPath, config.audit.path);

  const storage = new SqliteStorageBackend({ path: dbPath });
  await storage.init();

  try {
    const tenant = await storage.tenants.getOrCreateDefault();
    const generated = generateApiKey();
    await storage.apiKeys.create({
      tenantId: tenant.id,
      name: options.name ?? "cli-generated",
      keyHash: generated.keyHash,
      keyPrefix: generated.keyPrefix,
      createdBy: "cli",
    });

    console.log("");
    console.log("Your new API key (shown only once — store it now):");
    console.log("");
    console.log(`  ${generated.key}`);
    console.log("");
    console.log(
      `Use as: Authorization: Bearer ${generated.key.slice(0, 12)}...`
    );
    console.log(`Tenant: ${tenant.id}`);
  } finally {
    await storage.close();
  }
}
