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
import {
  runWebhookAdd,
  runWebhookList,
  runWebhookRemove,
} from "./commands/webhooks.js";
import { runServersList } from "./commands/servers.js";
import { runPoliciesList } from "./commands/policies.js";
import { runApprovalsList } from "./commands/approvals.js";
import { runPacksList } from "./commands/packs.js";

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
  mcpshield start [--config <path>] [--host <host>] [--port <n>] [--auth] [--no-watch]
  mcpshield policy lint [--config <path>]
  mcpshield key create [--config <path>] [--name <name>]
  mcpshield audit tail [--limit N] [--follow] [--flagged]
  mcpshield alerts list [--limit N]
  mcpshield webhooks add --url <url> --events <a,b,c> [--secret <s>]
  mcpshield webhooks list
  mcpshield webhooks remove <id>
  mcpshield servers list
  mcpshield policies list
  mcpshield approvals list [--limit N]
  mcpshield packs list
  mcpshield --version | --help

Commands:
  init             Scaffold mcpshield.yaml in the current directory.
  start            Load config, open SQLite storage, boot the gateway.
  policy lint      Validate the config against the schema.
  key create       Mint a new API key for the default tenant.
  audit tail       Print recent audit log entries from local SQLite.
  alerts list      Show recent flagged audit entries (denials, threats, errors).
  webhooks add     Register a new webhook subscriber.
  webhooks list    Show registered webhooks.
  webhooks remove  Delete a webhook by id.
  servers list     Show registered downstream MCP servers.
  policies list    Show enabled policy rules in priority order.
  approvals list   Show pending HITL approval requests.
  packs list       Show configured industry packs (load + introspect).

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
        noWatch: Boolean(args.flags["no-watch"]),
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

    case "webhooks":
      if (sub === "add") {
        await runWebhookAdd({
          configPath,
          url: args.flags.url as string | undefined,
          events: args.flags.events as string | undefined,
          secret: args.flags.secret as string | undefined,
        });
        return;
      }
      if (sub === "list") {
        await runWebhookList({ configPath });
        return;
      }
      if (sub === "remove") {
        await runWebhookRemove({
          configPath,
          id: args.positional[2],
        });
        return;
      }
      console.error(`Unknown subcommand: webhooks ${sub ?? ""}`);
      console.error("Try: mcpshield webhooks add|list|remove");
      process.exit(1);
      return;

    case "servers":
      if (sub === "list") {
        await runServersList({ configPath });
        return;
      }
      console.error(`Unknown subcommand: servers ${sub ?? ""}`);
      console.error("Try: mcpshield servers list");
      process.exit(1);
      return;

    case "policies":
      if (sub === "list") {
        await runPoliciesList({ configPath });
        return;
      }
      console.error(`Unknown subcommand: policies ${sub ?? ""}`);
      console.error("Try: mcpshield policies list");
      process.exit(1);
      return;

    case "approvals":
      if (sub === "list") {
        await runApprovalsList({
          configPath,
          limit: args.flags.limit ? Number(args.flags.limit) : undefined,
        });
        return;
      }
      console.error(`Unknown subcommand: approvals ${sub ?? ""}`);
      console.error("Try: mcpshield approvals list");
      process.exit(1);
      return;

    case "packs":
      if (sub === "list") {
        await runPacksList({ configPath });
        return;
      }
      console.error(`Unknown subcommand: packs ${sub ?? ""}`);
      console.error("Try: mcpshield packs list");
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
