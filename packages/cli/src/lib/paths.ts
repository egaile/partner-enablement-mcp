/**
 * Path resolution helpers for the CLI.
 *
 * Defaults the config to `./mcpshield.yaml` and the SQLite DB to
 * `./mcpshield.db` (relative to the config file). Both can be overridden
 * via CLI flags or the `audit.path` field in the config itself.
 */

import { dirname, isAbsolute, resolve } from "node:path";

export const DEFAULT_CONFIG_FILENAME = "mcpshield.yaml";
export const DEFAULT_DB_FILENAME = "mcpshield.db";

export function resolveConfigPath(input?: string): string {
  if (!input) return resolve(process.cwd(), DEFAULT_CONFIG_FILENAME);
  return resolve(process.cwd(), input);
}

/**
 * Resolve a DB path. If absolute, return as-is. Otherwise resolve relative
 * to the config file's directory so a project can carry `mcpshield.yaml` +
 * `mcpshield.db` together without depending on cwd.
 */
export function resolveDbPath(
  configPath: string,
  configuredDbPath?: string
): string {
  const fallback = configuredDbPath ?? DEFAULT_DB_FILENAME;
  if (fallback === ":memory:") return fallback;
  if (isAbsolute(fallback)) return fallback;
  return resolve(dirname(configPath), fallback);
}
