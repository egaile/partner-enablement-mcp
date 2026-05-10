/**
 * `mcpshield alerts list [--limit N]` — show recent flagged audit entries.
 *
 * Self-host has no separate alerts table; "alerts" is just the filtered
 * audit view (threats detected, denials, errors). Cloud has a richer
 * alerts surface in the dashboard.
 */

import { runAuditTail, type AuditTailOptions } from "./audit.js";

export interface AlertsListOptions {
  configPath?: string;
  limit?: number;
}

export async function runAlertsList(
  options: AlertsListOptions = {}
): Promise<void> {
  const opts: AuditTailOptions = {
    configPath: options.configPath,
    limit: options.limit ?? 50,
    onlyFlagged: true,
    follow: false,
  };
  await runAuditTail(opts);
}
