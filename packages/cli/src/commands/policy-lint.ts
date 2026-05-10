/**
 * `mcpshield policy lint` — validate the config file against the schema.
 *
 * Exits 0 with "OK" if the config parses cleanly. On failure, prints the
 * zod issue list and exits 1.
 */

import { relative } from "node:path";
import { ConfigError, loadConfig } from "@mcpshield/gateway-core";
import { resolveConfigPath } from "../lib/paths.js";

export interface PolicyLintOptions {
  configPath?: string;
}

export async function runPolicyLint(
  options: PolicyLintOptions = {}
): Promise<void> {
  const path = resolveConfigPath(options.configPath);
  try {
    const config = await loadConfig({ path });
    const rel = relative(process.cwd(), path);
    console.log(
      `${rel}: OK (${config.servers.length} server(s), ${config.policies.length} policy rule(s))`
    );
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
    } else {
      console.error("Unexpected error:", err);
    }
    process.exit(1);
  }
}
