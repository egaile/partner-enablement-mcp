# MCPShield

Open-core security and governance gateway for the Model Context Protocol.

MCPShield sits transparently between AI agents and downstream MCP servers, intercepting every `tools/list` and `tools/call`. It runs a layered security pipeline — prompt-injection scanning, PII detection, policy enforcement, drift detection, rate limiting, human-in-the-loop approval, and tamper-evident audit logging — before forwarding the request, then scans and (optionally) redacts the response on the way back.

The data plane is MIT-licensed and runs on your laptop in 60 seconds. The cloud control plane (multi-tenancy, hosted dashboard, billing, SSO) is the commercial layer.

```
+----------------------+      +------------------+      +---------------------+
|   AI client          | ---> |    MCPShield     | ---> |  Downstream MCP     |
|  (Claude, Cursor,    | <--- |  scan / policy / | <--- |  (Atlassian, Linear |
|   VS Code, custom)   |      |  audit / approve |      |   Postgres, Slack…) |
+----------------------+      +------------------+      +---------------------+
```

---

## 60-second self-host

```bash
npm install -g @mcpshield/cli         # or: npx @mcpshield/cli ...
mcpshield init                        # writes mcpshield.yaml
mcpshield start                       # boots gateway on http://127.0.0.1:4000
```

Then point any MCP client at `http://127.0.0.1:4000/mcp`. The gateway exposes `/health` for liveness and `/mcp` for the Streamable HTTP transport.

Useful follow-ups:

```bash
mcpshield key create                  # mint an API key for /mcp auth
mcpshield policy lint                 # validate mcpshield.yaml
mcpshield audit tail --follow         # live audit feed
mcpshield alerts list                 # only flagged events (denials, threats, errors)
mcpshield webhooks add --url ... --events injection_detected,server_error
```

---

## Open-core split

The repo is a single npm workspaces monorepo. Everything under `packages/` is MIT and publishable to npm; everything under `gateway/` and `dashboard/` is commercial.

### Open (MIT) — `packages/`

| Package | Purpose |
|---|---|
| **`@mcpshield/gateway-core`** | Proxy engine, scanner pipeline, PII registry, policy engine, drift detector, audit logger, rate limiter, webhook dispatcher, approval queue, OAuth 2.1 client. `StorageBackend` abstraction with a SQLite reference impl. |
| **`@mcpshield/cli`** | `init` / `start` / `policy lint` / `key create` / `audit tail` / `alerts list` / `webhooks add\|list\|remove`. Boots the gateway against a local SQLite DB. |
| **`@mcpshield/sdk`** | `definePack()` — author your own industry packs (PII patterns, policy templates, compliance frameworks). |
| **`@mcpshield/pack-saas`** | Reference SaaS/SOC2 pack. The template for new packs. |

### Commercial — `gateway/`, `dashboard/`

| Component | Purpose |
|---|---|
| **`gateway/`** | Cloud control plane: multi-tenancy, Clerk SSO, Stripe billing, Atlassian-aware audit enrichment + injection scanner, hosted alerts, OAuth state persistence, REST API for the dashboard. |
| **`dashboard/`** | Next.js 14 admin UI — server registry, policy builder, audit explorer, alert feed, approval queue, team management, billing. |

### Cloud ports — how the two halves connect

The core defines four small interfaces in `packages/gateway-core/src/proxy/ports.ts` that the cloud implements:

- **`AlertSink`** — fire-and-forget alert dispatch. Cloud: persists to Supabase + delivers webhooks.
- **`BillingGuard`** — per-tenant usage limit check. Cloud: PlanCache + Stripe.
- **`OAuthProviderFactory`** — builds MCP SDK OAuth providers per downstream server.
- **`AuditRecorder`** — persists audit entries with optional enrichment.

Self-host configurations omit these and get safe no-op defaults.

See [`/Users/edgaile/.claude/plans/so-we-started-down-buzzing-hippo.md`](.claude/plans/so-we-started-down-buzzing-hippo.md) for the productization strategy that shaped this split.

---

## Architecture

```
+---------------------------------------------------------------+
|                        AI CLIENT                              |
|     Claude Desktop / Cursor / VS Code / your custom agent     |
+---------------------------------------------------------------+
                            |
                    MCP JSON-RPC (Streamable HTTP)
                            |
+---------------------------------------------------------------+
|                 GatewayProxyEngine (gateway-core)             |
|                                                               |
|  Auth --> Usage limits --> Policy --> Rate limit --> Scanner  |
|       --> PII --> Drift --> Approval gate --> Forward         |
|       --> Response scan --> PII redact --> Audit              |
|                                                               |
|  + WebhookDispatcher (auto-fired by AlertSink)                |
|  + HealthChecker     + ApprovalEngine                         |
+---------------------------------------------------------------+
                            |
              MCP JSON-RPC (stdio | Streamable HTTP)
                            |
+---------------------------------------------------------------+
|                DOWNSTREAM MCP SERVERS                         |
|   any combination — Atlassian Rovo, Linear, Postgres, Slack,  |
|   your own internal tools …                                   |
+---------------------------------------------------------------+
```

### Storage

The core only depends on a `StorageBackend` interface. Two reference implementations:

- **`SqliteStorageBackend`** (in core) — WAL-mode SQLite via `better-sqlite3`. Bootstraps schema on `init()`. Used by the CLI.
- **`SupabaseStorageBackend`** (in `gateway/`) — multi-tenant Postgres with RLS. Used by the cloud.

Want a different store (Postgres direct, DynamoDB, etc.)? Implement `StorageBackend` from `@mcpshield/gateway-core/storage`. The proxy hot path is unchanged.

### Policy actions

Policies are evaluated in priority order; first match wins. Four actions:

- **`allow`** — proceed (default when no rule matches).
- **`deny`** — block with the rule's name in the response.
- **`require_approval`** — block, create a pending request in the queue, return its id. The caller re-runs the tool with `arguments.__approvalId = <id>` once an admin approves; the interceptor verifies the id matches the same tenant/user/server/tool, strips the marker, and proceeds.
- **`log_only`** — proceed, but flag in the audit log. Useful for collecting SOC2 evidence without blocking traffic.

Modifiers: `redactPII`, `redactSecrets`, `maxCallsPerMinute`, `requireMFA`.

---

## Repo layout

```
.
├── packages/
│   ├── gateway-core/        # MIT — the OSS gateway
│   ├── cli/                 # MIT — @mcpshield/cli
│   ├── sdk/                 # MIT — industry-pack SDK
│   └── pack-saas/           # MIT — reference pack
├── gateway/                 # Commercial — cloud control plane
├── dashboard/               # Commercial — admin UI
├── mcp-server/              # Portfolio demo (separate product)
├── web-demo/                # Portfolio demo (separate product)
├── LICENSE                  # MIT (applies to packages/)
└── LICENSE-COMMERCIAL       # Commercial license (gateway/ + dashboard/)
```

### Build / test

```bash
npm install                                       # all workspaces

npm run --workspace @mcpshield/gateway-core build # tsc
npm run --workspace @mcpshield/gateway-core test  # vitest

npm run --workspace @mcpshield/cli build
npm run --workspace mcp-security-gateway build
npm run --workspace mcp-security-gateway test

npm run --workspaces --if-present build           # everything
```

---

## Bundled portfolio demo

This repo also contains a Partner Solutions Architect portfolio demo that exercises the cloud build of MCPShield against live Atlassian Rovo MCP tools:

- **`mcp-server/`** — a standalone MCP server with 4 partner-enablement tools (project context, reference architectures, compliance assessment, implementation plans). TypeScript + `@modelcontextprotocol/sdk`. Independent of the gateway.
- **`web-demo/`** — Next.js app that drives 30+ Rovo tools through the cloud gateway, with 4 enterprise workflows (Deployment Planning, Knowledge Base Audit, Sprint Operations, Risk Radar) plus two standalone features (Security Threat Simulator, Governance Control Room).

These are demos, not part of the open-core or commercial product line.

---

## License

- **`packages/`** — MIT (see [`LICENSE`](LICENSE)). Use it, fork it, sell it, no strings.
- **`gateway/`**, **`dashboard/`**, **`packages/pack-saas/`** — commercial (see [`LICENSE-COMMERCIAL`](LICENSE-COMMERCIAL)). Evaluation-only reading; modification or redistribution requires a written license.

---

## Author

Ed Gaile · [linkedin.com/in/edgaile](https://linkedin.com/in/edgaile) · [github.com/egaile](https://github.com/egaile)
