# @mcpshield/cli

Command-line interface for [MCPShield](../../README.md).

## Install

```bash
npm install -g @mcpshield/cli
```

Or run without installing:

```bash
npx @mcpshield/cli init
```

## Commands

```
mcpshield init [--force]              Scaffold mcpshield.yaml
mcpshield start [--config <p>]        Load config, open SQLite storage, start the gateway
                [--host <h>] [--port <n>] [--auth] [--no-watch]
mcpshield policy lint                 Validate the config against the schema
mcpshield key create [--name <n>]     Mint an API key for the default tenant
mcpshield audit tail [--limit N]      Print recent audit log entries
                [--follow] [--flagged]
mcpshield alerts list [--limit N]     Show flagged audit entries (denials, threats, errors)
mcpshield webhooks add --url <u> --events <a,b> [--secret <s>]
mcpshield webhooks list               Show registered webhooks
mcpshield webhooks remove <id>        Delete a webhook
mcpshield servers list                Show registered downstream MCP servers
mcpshield policies list               Show enabled policy rules in priority order
mcpshield approvals list [--limit N]  Show pending approval requests
mcpshield packs list                  Show configured industry packs
mcpshield templates list              Show policy templates from loaded packs
                [--category access|security|compliance]
mcpshield templates apply <id>        Add a template's rules to the local policy table
mcpshield --version | --help
```

Every command accepts `--config <path>` (default: `./mcpshield.yaml`). Packs are configured in the `packs:` list in `mcpshield.yaml` and installed with npm; there is no `pack add` command.

## License

MIT
