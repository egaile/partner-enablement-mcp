# MCPShield

Open-core security and governance gateway for the Model Context Protocol.

MCPShield is a proxy between AI agents and downstream MCP servers. It intercepts every `tools/list` and `tools/call` and runs a series of checks before forwarding the request: policy enforcement, human-in-the-loop approval, rate limiting, prompt-injection scanning, PII detection, and drift detection. On the way back it scans the response, optionally redacts PII, and writes an audit log entry.

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

### Open (MIT): `packages/`

| Package | Purpose |
|---|---|
| **`@mcpshield/gateway-core`** | Proxy engine, scanner pipeline, PII registry, policy engine, drift detector, audit logger, rate limiter, webhook dispatcher, approval queue. Defines an `OAuthProviderFactory` port for downstream OAuth (the cloud gateway implements it). `StorageBackend` abstraction with a SQLite reference impl. |
| **`@mcpshield/cli`** | `init` / `start` / `policy lint` / `key create` / `audit tail` / `alerts list` / `webhooks add\|list\|remove` / `servers list` / `policies list` / `approvals list` / `packs list` / `templates list\|apply`. Boots the gateway against a local SQLite DB. |
| **`@mcpshield/sdk`** | `definePack()` for writing your own industry packs (PII patterns, policy templates, compliance frameworks). |
| **`@mcpshield/pack-saas`** | Reference SaaS/SOC2 pack. The template for new packs. |
| **`@mcpshield/pack-healthcare`** | Healthcare/HIPAA pack: PHI detection (NPI, ICD-10, DEA), PHI redaction policy templates, HIPAA compliance metadata. |

### Commercial: `gateway/`, `dashboard/`, `packs-private/`

| Component | Purpose |
|---|---|
| **`gateway/`** | Cloud control plane: multi-tenancy, Clerk SSO, Stripe billing, Atlassian-aware audit enrichment + injection scanner, hosted alerts, OAuth state persistence, REST API for the dashboard. Proxies HTTP downstream servers only; stdio servers need the self-hosted CLI. |
| **`dashboard/`** | Next.js 14 admin UI: server registry, policy builder, audit explorer, alert feed, approval queue, team management, billing. |
| **`packs-private/pack-atlassian`** | `@mcpshield/pack-atlassian`: Jira and Confluence injection scanner, audit metadata enrichment, and policy templates. Commercial license. |

### Cloud ports: how the two halves connect

The core defines four small interfaces in `packages/gateway-core/src/proxy/ports.ts` that the cloud implements:

- **`AlertSink`**: fire-and-forget alert dispatch. Cloud: persists to Supabase + delivers webhooks.
- **`BillingGuard`**: per-tenant usage limit check. Cloud: PlanCache + Stripe.
- **`OAuthProviderFactory`**: builds MCP SDK OAuth providers per downstream server.
- **`AuditRecorder`**: persists audit entries with optional enrichment.

Self-host configurations omit these and get safe no-op defaults.

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
|  Auth --> Usage limit --> Policy --> Approval gate            |
|       --> Rate limit --> Injection scan --> PII detect (req)  |
|       --> Drift check --> Forward                             |
|       --> Response injection scan (log only)                  |
|       --> Response PII redact --> Audit                       |
|                                                               |
|  + WebhookDispatcher (auto-fired by AlertSink)                |
|  + HealthChecker     + ApprovalEngine                         |
+---------------------------------------------------------------+
                            |
    MCP JSON-RPC (Streamable HTTP, or stdio on self-host only)
                            |
+---------------------------------------------------------------+
|                DOWNSTREAM MCP SERVERS                         |
|   any combination: Atlassian Rovo, Linear, Postgres, Slack,   |
|   your own internal tools …                                   |
+---------------------------------------------------------------+
```

### Storage

The core only depends on a `StorageBackend` interface. Two reference implementations:

- **`SqliteStorageBackend`** (in core): WAL-mode SQLite via `better-sqlite3`. Bootstraps schema on `init()`. Used by the CLI.
- **`SupabaseStorageBackend`** (in `gateway/`): multi-tenant Postgres with RLS. Used by the cloud.

Want a different store (Postgres direct, DynamoDB, etc.)? Implement `StorageBackend` from `@mcpshield/gateway-core/storage`. The proxy hot path is unchanged.

### Policy actions

Policies are evaluated in priority order; first match wins. Four actions:

- **`allow`**: proceed (default when no rule matches).
- **`deny`**: block with the rule's name in the response.
- **`require_approval`**: block, create a pending request in the queue, return its id. The caller re-runs the tool with `arguments.__approvalId = <id>` once an admin approves; the interceptor verifies the id matches the same tenant/user/server/tool, strips the marker, and proceeds. The retry must send the same arguments the admin approved. The approval works for 1 hour after the admin decides (`APPROVAL_EXECUTION_WINDOW_MS`) and is not single-use yet, so it can be reused with the same arguments inside that hour. On the hosted gateway only owners and admins can approve or reject, the requester can't decide their own request (a request made with an API key counts as made by the key's creator), and API-key callers can't decide at all.
- **`log_only`**: proceed, but flag in the audit log. Useful for collecting SOC2 evidence without blocking traffic.

Modifiers: `redactPII`, `maxCallsPerMinute`. The config schema also accepts `redactSecrets` and `requireMFA`, but the proxy does not enforce them yet.

---

## Repo layout

```
.
├── packages/
│   ├── gateway-core/        # MIT: the OSS gateway
│   ├── cli/                 # MIT: @mcpshield/cli
│   ├── sdk/                 # MIT: industry-pack SDK
│   ├── pack-saas/           # MIT: reference pack
│   └── pack-healthcare/     # MIT: healthcare/HIPAA pack
├── packs-private/
│   └── pack-atlassian/      # Commercial: Atlassian pack
├── gateway/                 # Commercial: cloud control plane
├── dashboard/               # Commercial: admin UI
├── mcp-server/              # Portfolio demo (separate product)
├── web-demo/                # Portfolio demo (separate product)
├── LICENSE                  # MIT (applies to packages/)
└── LICENSE-COMMERCIAL       # Commercial license (gateway/ + dashboard/)
```

### Build / test

```bash
npm install         # all workspaces

npm run build       # dependency-ordered: sdk → gateway-core → packs → cli + gateway
npm test            # vitest across every workspace

# Per-package, when iterating on one:
npm run --workspace @mcpshield/gateway-core build
npm run --workspace @mcpshield/gateway-core test
```

> `npm run --workspaces --if-present build` doesn't honor dependency order. Use the root `npm run build` from a fresh checkout.

---

## Bundled portfolio demo

This repo also contains a Partner Solutions Architect portfolio demo that exercises the cloud build of MCPShield against live Atlassian Rovo MCP tools:

- **`mcp-server/`**: a standalone MCP server with 4 partner-enablement tools (project context, reference architectures, compliance assessment, implementation plans). TypeScript + `@modelcontextprotocol/sdk`. Independent of the gateway.
- **`web-demo/`**: Next.js app that drives 30+ Rovo tools through the cloud gateway, with 4 workflows (Deployment Planning, Knowledge Base Audit, Sprint Operations, Risk Radar) plus two standalone features (Security Threat Simulator, Governance Control Room).

These are demos, not part of the open-core or commercial product line.

---

## License

- **`packages/`** (gateway-core, cli, sdk, pack-saas, pack-healthcare): MIT (see [`LICENSE`](LICENSE)). Use it, fork it, sell it, no strings.
- **`gateway/`**, **`dashboard/`**, **`packs-private/`**: commercial (see [`LICENSE-COMMERCIAL`](LICENSE-COMMERCIAL)). Evaluation-only reading; modification or redistribution requires a written license.

---

## Author

Ed Gaile · [linkedin.com/in/edgaile](https://linkedin.com/in/edgaile) · [github.com/egaile](https://github.com/egaile)
