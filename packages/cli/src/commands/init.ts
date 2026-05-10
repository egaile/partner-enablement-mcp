/**
 * `mcpshield init` — scaffold a starter `mcpshield.yaml` in the current
 * directory.
 *
 * Refuses to overwrite an existing file unless `--force` is passed.
 */

import { existsSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { resolveConfigPath } from "../lib/paths.js";

const STARTER_YAML = `# mcpshield.yaml — open-core MCP security gateway config.
# Docs: https://github.com/anthropics/mcpshield  (replace with your repo URL)

server:
  host: 127.0.0.1   # bind to loopback by default; set to 0.0.0.0 to expose
  port: 4000

audit:
  backend: sqlite
  path: ./mcpshield.db

# Industry packs to load. Each pack contributes PII patterns + policy templates.
# Install with: npm install @mcpshield/pack-saas
packs: []
  # - "@mcpshield/pack-saas"

# Downstream MCP servers to proxy. Removing an entry deletes it on next start.
servers: []
  # Example — local stdio server:
  # - id: my-local-server
  #   name: "My Local Server"
  #   transport: stdio
  #   command: node
  #   args: ["./server.js"]
  #
  # Example — remote HTTP server with bearer token:
  # - id: linear-mcp
  #   name: "Linear"
  #   transport: http
  #   url: https://mcp.linear.app/mcp
  #   auth: static
  #   authHeaders:
  #     Authorization: "Bearer \${LINEAR_TOKEN}"
  #
  # Example — OAuth 2.1 downstream:
  # - id: atlassian
  #   name: "Atlassian Rovo"
  #   transport: http
  #   url: https://mcp.atlassian.com/v1/sse
  #   auth: oauth2
  #   oauth:
  #     scopes: ["read:jira-work", "write:jira-work"]

# Policy rules. Evaluated in priority order; first match wins.
policies: []
  # - name: "Audit everything"
  #   description: "SOC2-style baseline — log every tool call"
  #   priority: 1000
  #   conditions:
  #     tools: ["*"]
  #   action: log_only
  #
  # - name: "Deny destructive writes outside business hours"
  #   priority: 500
  #   conditions:
  #     tools: ["*__delete*", "*__drop*"]
  #     timeWindows:
  #       - daysOfWeek: [0, 6]      # Sun, Sat
  #   action: deny
`;

export interface InitOptions {
  configPath?: string;
  force?: boolean;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const path = resolveConfigPath(options.configPath);

  if (existsSync(path) && !options.force) {
    console.error(
      `${relative(process.cwd(), path)} already exists. Use --force to overwrite.`
    );
    process.exit(1);
  }

  writeFileSync(path, STARTER_YAML, "utf-8");
  console.log(`Wrote ${relative(process.cwd(), path)}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Edit ${relative(process.cwd(), path)} — add at least one server.`);
  console.log("  2. Run: mcpshield start");
}
