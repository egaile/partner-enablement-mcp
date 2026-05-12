/**
 * `mcpshield approvals list [--limit N]` — show pending human-in-the-loop
 * approval requests created by `require_approval` policy decisions.
 *
 * Each row shows the id, requesting user, tool, requested timestamp, and
 * the original params (one line, truncated). Approve them by re-running
 * the original tool call with `arguments.__approvalId = <id>`.
 *
 * (CLI approve / reject is intentionally not exposed here yet — approvals
 * are a security-sensitive write that should go through an admin UI or
 * REST API with proper attribution.)
 */

import {
  ApprovalEngine,
  SqliteStorageBackend,
  loadConfig,
} from "@mcpshield/gateway-core";
import { resolveConfigPath, resolveDbPath } from "../lib/paths.js";

export interface ApprovalsListOptions {
  configPath?: string;
  limit?: number;
}

export async function runApprovalsList(
  options: ApprovalsListOptions = {}
): Promise<void> {
  const configPath = resolveConfigPath(options.configPath);
  const config = await loadConfig({ path: configPath });
  const dbPath = resolveDbPath(configPath, config.audit.path);

  const storage = new SqliteStorageBackend({ path: dbPath });
  await storage.init();
  try {
    const tenant = await storage.tenants.getOrCreateDefault();
    const engine = new ApprovalEngine({ approvals: storage.approvals });
    const result = await engine.getPending(tenant.id, {
      limit: options.limit ?? 50,
    });

    if (result.count === 0) {
      console.log("No pending approvals.");
      return;
    }
    console.log(`${result.count} pending approval(s):`);
    console.log("");
    for (const r of result.data) {
      const params = truncate(JSON.stringify(r.params), 80);
      console.log(`${r.id}  ${r.requestedAt}`);
      console.log(
        `  user: ${r.userId}  tool: ${r.serverName}__${r.toolName}`
      );
      console.log(`  params: ${params}`);
      console.log(`  expires: ${r.expiresAt}`);
    }
  } finally {
    await storage.close();
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
