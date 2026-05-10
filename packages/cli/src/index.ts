#!/usr/bin/env node
/**
 * @mcpshield/cli — entrypoint
 *
 * Phase 0 scaffold. Commands: init, start, policy lint, pack list/add.
 */

const args = process.argv.slice(2);
const cmd = args[0];

function usage(): void {
  console.log(`
mcpshield — MCP security gateway

Usage: mcpshield <command> [options]

Commands:
  init                 Scaffold mcpshield.yaml in the current directory
  start [--config <p>] Start the gateway
  policy lint          Validate the policies in your config
  pack list            List packs available + active
  pack add <name>      Install a pack from npm
  --version            Print version
  --help               Show this help
`);
}

async function main(): Promise<void> {
  if (!cmd || cmd === "--help" || cmd === "-h") {
    usage();
    return;
  }
  if (cmd === "--version" || cmd === "-v") {
    console.log("0.1.0");
    return;
  }

  // Phase 0: command implementations land as gateway-core surfaces stabilize.
  console.error(`Command "${cmd}" not yet implemented.`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
