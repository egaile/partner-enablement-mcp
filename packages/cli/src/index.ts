#!/usr/bin/env node
/**
 * @mcpshield/cli — entrypoint
 *
 * Tiny hand-rolled argv parser. No commander/yargs dep — the surface is
 * small enough that a switch statement is clearer than a framework.
 */

import { runInit } from "./commands/init.js";
import { runStart } from "./commands/start.js";
import { runPolicyLint } from "./commands/policy-lint.js";
import { runKeyCreate } from "./commands/key.js";
import { runAuditTail } from "./commands/audit.js";
import { runAlertsList } from "./commands/alerts.js";

const VERSION = "0.1.0";

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function usage(): void {
  console.log(`
mcpshield — open-core MCP security gateway

Usage:
  mcpshield init [--force] [--config <path>]
  mcpshield start [--config <path>] [--host <host>] [--port <n>] [--auth]
  mcpshield policy lint [--config <path>]
  mcpshield key create [--config <path>] [--name <name>]
  mcpshield audit tail [--limit N] [--follow] [--flagged]
  mcpshield alerts list [--limit N]
  mcpshield --version | --help

Commands:
  init           Scaffold mcpshield.yaml in the current directory.
  start          Load config, open SQLite storage, boot the gateway.
  policy lint    Validate the config against the schema.
  key create     Mint a new API key for the default tenant.
  audit tail     Print recent audit log entries from local SQLite.
  alerts list    Show recent flagged audit entries (denials, threats, errors).

Common flags:
  --config <path>   Path to mcpshield.yaml (default: ./mcpshield.yaml)
  --version, -v     Print version
  --help, -h        Show this help

Docs: https://github.com/anthropics/mcpshield   (replace with your repo URL)
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const [cmd, sub] = args.positional;

  if (!cmd || cmd === "--help" || cmd === "-h" || args.flags.help) {
    usage();
    return;
  }
  if (cmd === "--version" || cmd === "-v" || args.flags.version) {
    console.log(VERSION);
    return;
  }

  const configPath = args.flags.config as string | undefined;

  switch (cmd) {
    case "init":
      await runInit({
        configPath,
        force: Boolean(args.flags.force),
      });
      return;

    case "start":
      await runStart({
        configPath,
        host: args.flags.host as string | undefined,
        port: args.flags.port
          ? Number(args.flags.port)
          : undefined,
        requireAuth: Boolean(args.flags.auth),
      });
      return;

    case "policy":
      if (sub === "lint") {
        await runPolicyLint({ configPath });
        return;
      }
      console.error(`Unknown subcommand: policy ${sub ?? ""}`);
      console.error("Try: mcpshield policy lint");
      process.exit(1);
      return;

    case "key":
      if (sub === "create") {
        await runKeyCreate({
          configPath,
          name: args.flags.name as string | undefined,
        });
        return;
      }
      console.error(`Unknown subcommand: key ${sub ?? ""}`);
      console.error("Try: mcpshield key create");
      process.exit(1);
      return;

    case "audit":
      if (sub === "tail") {
        await runAuditTail({
          configPath,
          limit: args.flags.limit
            ? Number(args.flags.limit)
            : undefined,
          follow: Boolean(args.flags.follow),
          onlyFlagged: Boolean(args.flags.flagged),
        });
        return;
      }
      console.error(`Unknown subcommand: audit ${sub ?? ""}`);
      console.error("Try: mcpshield audit tail");
      process.exit(1);
      return;

    case "alerts":
      if (sub === "list") {
        await runAlertsList({
          configPath,
          limit: args.flags.limit
            ? Number(args.flags.limit)
            : undefined,
        });
        return;
      }
      console.error(`Unknown subcommand: alerts ${sub ?? ""}`);
      console.error("Try: mcpshield alerts list");
      process.exit(1);
      return;

    default:
      console.error(`Unknown command: ${cmd}`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
