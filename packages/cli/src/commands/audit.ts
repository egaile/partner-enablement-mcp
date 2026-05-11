/**
 * `mcpshield audit tail [--limit N] [--follow]` — print recent audit log
 * entries from the local SQLite store.
 *
 * In --follow mode, polls every 2 seconds for entries newer than the last
 * seen row. Ctrl-C to exit.
 */

import {
  SqliteStorageBackend,
  loadConfig,
  type AuditLogRecord,
} from "@mcpshield/gateway-core";
import { resolveConfigPath, resolveDbPath } from "../lib/paths.js";

export interface AuditTailOptions {
  configPath?: string;
  limit?: number;
  follow?: boolean;
  onlyFlagged?: boolean;
}

export async function runAuditTail(
  options: AuditTailOptions = {}
): Promise<void> {
  const configPath = resolveConfigPath(options.configPath);
  const config = await loadConfig({ path: configPath });
  const dbPath = resolveDbPath(configPath, config.audit.path);

  const storage = new SqliteStorageBackend({ path: dbPath });
  await storage.init();

  try {
    const tenant = await storage.tenants.getOrCreateDefault();
    const limit = options.limit ?? 25;

    const initial = await storage.audit.list(tenant.id, {
      limit,
      onlyFlagged: options.onlyFlagged,
    });
    // Newest-first from storage; print oldest-first so the tail end is visible.
    for (const row of [...initial].reverse()) {
      printAuditRow(row);
    }

    if (!options.follow) return;

    let cursor = initial[0]?.createdAt;
    console.error("[mcpshield] following audit log (Ctrl-C to stop)…");

    // Block forever; the SIGINT handler exits.
    while (true) {
      await sleep(2000);
      const next = await storage.audit.list(tenant.id, {
        limit: 100,
        afterCreatedAt: cursor,
        onlyFlagged: options.onlyFlagged,
      });
      if (next.length > 0) {
        for (const row of [...next].reverse()) {
          printAuditRow(row);
        }
        cursor = next[0].createdAt;
      }
    }
  } finally {
    await storage.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function printAuditRow(row: AuditLogRecord): void {
  const ts = row.createdAt;
  const decision = row.policyDecision.padEnd(15);
  const flags: string[] = [];
  if (row.threatsDetected > 0) flags.push(`threats=${row.threatsDetected}`);
  if (row.driftDetected) flags.push("drift");
  if (row.requestPiiDetected) flags.push("pii-in");
  if (row.responsePiiDetected) flags.push("pii-out");
  if (!row.success) flags.push("error");
  const flagStr = flags.length > 0 ? ` [${flags.join(",")}]` : "";
  const error = row.errorMessage ? ` — ${row.errorMessage}` : "";
  console.log(
    `${ts}  ${decision}  ${row.serverName}__${row.toolName}  ${row.latencyMs.toFixed(0)}ms${flagStr}${error}`
  );
}
