# Contributing to MCPShield

Thanks for your interest. This repo is the source for **MCPShield's open-core gateway, CLI, SDK, and reference packs** plus the commercial cloud control plane.

The open packages (everything under `packages/`) are MIT and welcome external contributions. The commercial parts (`gateway/`, `dashboard/`, `packs-private/`) accept contributions only from the project maintainer.

## Layout

```
packages/                # MIT — open source
  gateway-core/          # @mcpshield/gateway-core — the OSS gateway
  cli/                   # @mcpshield/cli — `mcpshield` binary
  sdk/                   # @mcpshield/sdk — IndustryPack contract
  pack-saas/             # @mcpshield/pack-saas — reference pack
  pack-healthcare/       # @mcpshield/pack-healthcare — HIPAA pack
packs-private/           # commercial
  pack-atlassian/        # @mcpshield/pack-atlassian — Jira + Confluence
gateway/                 # commercial — cloud control plane
dashboard/               # commercial — admin UI
mcp-server/, web-demo/   # portfolio demo apps (separate product)
```

## Local setup

```bash
git clone https://github.com/egaile/partner-enablement-mcp.git
cd partner-enablement-mcp
npm install                             # picks up every workspace

# Build everything in dependency order:
npm run --workspaces --if-present build

# Test everything:
npm run --workspaces --if-present test
```

Node ≥ 20 is required (CI runs against 20 + 22).

## Running the gateway from source

```bash
cd /tmp && mkdir mcpshield-dev && cd mcpshield-dev
node /path/to/this/repo/packages/cli/dist/index.js init
node /path/to/this/repo/packages/cli/dist/index.js start
# /health on :4000, /mcp for the Streamable HTTP transport
```

## How the code is organized

Everything the proxy needs at request time is in **`@mcpshield/gateway-core`**:

- `proxy/` — `GatewayProxyEngine`, `ConnectionManager`, `ToolInterceptor`, `HealthChecker`
- `security/` — scanner pipeline (4 generic strategies + PII registry + rate limiter)
- `policy/` — policy engine with glob matching + cache
- `audit/` — buffered batch writer + correlation IDs + enricher registry
- `monitor/` — drift detector with SHA-256 tool snapshots
- `approval/` — HITL approval queue (engine + storage port)
- `webhooks/` — HMAC-signed delivery with SSRF allowlist + `AlertSink` adapter
- `packs/` — runtime loader for industry packs
- `storage/` — `StorageBackend` interface + SQLite reference impl
- `auth/` — `AuthProvider` interface + API-key reference impl
- `config/` — YAML config loader with hot-reload

The cloud build (`gateway/`) extends this via four small ports defined in `packages/gateway-core/src/proxy/ports.ts`: `AlertSink`, `BillingGuard`, `OAuthProviderFactory`, `AuditRecorder`. Self-host runs with no-op defaults.

## Writing a new industry pack

A pack is a tiny npm module that contributes PII patterns, policy templates, scanner strategies, audit enrichers, and exempt domains to a running gateway. The full contract is in [`packages/sdk/src/index.ts`](packages/sdk/src/index.ts).

Minimum viable pack:

```ts
// packages/pack-myindustry/src/index.ts
import { definePack } from "@mcpshield/sdk";

export default definePack({
  id: "myindustry",
  name: "My Industry",
  description: "Short description.",
  pii: [
    {
      type: "license_number",
      pattern: /\b[A-Z]{2}-\d{6}\b/g,
      classification: "restricted",
      redactionLabel: "[LIC]",
    },
  ],
  policyTemplates: [
    {
      id: "myindustry_audit_everything",
      name: "Audit Everything",
      description: "Log every tool call.",
      category: "compliance",
      rules: [{
        name: "log all",
        description: "log all tools",
        priority: 1000,
        conditions: { tools: ["*"] },
        action: "log_only",
      }],
    },
  ],
  compliance: [{ id: "myindustry_compliance", name: "My Industry Spec" }],
  defaultClassification: "internal",
});
```

Then in any `mcpshield.yaml`:

```yaml
packs:
  - "@mcpshield/pack-myindustry"
```

The gateway loads it at boot, registers everything, and exposes templates via `mcpshield templates list`. See [`packages/pack-healthcare/`](packages/pack-healthcare/) for a fuller example with custom validators (NPI Luhn checksum, DEA checksum).

## Workflow

1. Open an issue first for non-trivial work — saves a PR cycle when scope is contested.
2. Fork + branch off `main`.
3. Make your change. Keep commits focused.
4. Run `npm run --workspaces --if-present test` locally before pushing.
5. Open a PR against `main`. CI will run on Node 20 + 22.
6. Address review comments by adding follow-up commits (don't force-push).

## Code style

- TypeScript strict mode. No `any`.
- All MCP tool responses return `{ content: [{ type: "text", text }], structuredContent }` or `{ isError: true, content }` on failure.
- Zod for runtime validation on inputs at the system boundary; don't re-validate trusted internal types.
- Default to writing no comments. Add one only when the *why* is non-obvious (a hidden constraint, a subtle invariant, a workaround for a specific bug). Don't explain *what* the code does — well-named identifiers already do that.

## What to expect from review

A reviewer (probably the project maintainer) will look at:

- **Test coverage** — new behavior gets new tests. Aim for the smallest test that proves the behavior.
- **Public API stability** — additions are fine; signature changes to anything exported from `@mcpshield/gateway-core` or `@mcpshield/sdk` need rationale.
- **Cloud port discipline** — `gateway-core` must not import from `gateway/` or `dashboard/`. Cloud-specific concerns plug in via ports.
- **Pack scope** — packs should contribute *data + small focused logic* (PII regexes, audit enrichment functions). They shouldn't reach into gateway-core internals.

## License

By contributing to packages under `packages/`, you agree your contributions are licensed under MIT (the per-package LICENSE files). Commercial-license repos in `gateway/`, `dashboard/`, and `packs-private/` accept contributions from the maintainer only; if you want to contribute to those, open an issue first.

## Questions

Open an issue or email egaile@gmail.com.
