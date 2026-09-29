# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repo holds two products that share one npm workspaces monorepo:

1. **MCPShield** (working name, see `BRAND.md`): an open-core security gateway for the Model Context Protocol. It sits between AI clients and downstream MCP servers and runs every `tools/call` through policy, scanning, drift, approval and audit checks.
2. **Partner enablement portfolio demo**: the original project, built for an Anthropic Partner Solutions Architect application. An MCP server with 4 partner tools, plus a Next.js demo that drives live Atlassian Rovo tools through the hosted MCPShield gateway.

| Path | Package name | License | What it is |
|---|---|---|---|
| `packages/gateway-core` | `@mcpshield/gateway-core` | MIT | Proxy engine, interceptor pipeline, scanners, policy, drift, approvals, webhooks, storage interface + SQLite impl |
| `packages/cli` | `@mcpshield/cli` | MIT | `mcpshield` binary; self-hosted gateway on SQLite |
| `packages/sdk` | `@mcpshield/sdk` | MIT | `definePack()` and the `IndustryPack` contract |
| `packages/pack-saas` | `@mcpshield/pack-saas` | MIT | Reference SaaS/SOC2 pack |
| `packages/pack-healthcare` | `@mcpshield/pack-healthcare` | MIT | HIPAA pack (NPI, DEA, ICD-10, MRN patterns) |
| `packs-private/pack-atlassian` | `@mcpshield/pack-atlassian` | Commercial | Jira/Confluence injection strategy, audit enricher, 6 policy templates |
| `gateway/` | `mcp-security-gateway` | Commercial | Hosted multi-tenant control plane (Express, Supabase, Clerk, Stripe) |
| `dashboard/` | `mcp-security-dashboard` | Commercial | Next.js 14 admin UI for the hosted gateway |
| `mcp-server/` | `partner-enablement-mcp-server` | Demo | 4 partner-enablement MCP tools |
| `web-demo/` | `partner-enablement-demo` | Demo | Next.js 14 demo app (Vercel) |

## Development Commands

Node 20+ (CI runs 20 and 22). Install once at the root; every package is a workspace.

```bash
npm install                 # all workspaces
npm run build               # dependency-ordered: sdk -> gateway-core -> packs -> cli -> gateway
npm test                    # vitest in every workspace that has tests
```

Always build from the root. `npm run --workspaces build` goes alphabetically and breaks because consumers type-check before `@mcpshield/sdk` / `gateway-core` have emitted `.d.ts` files. `mcp-server`, `web-demo` and `dashboard` are not in the root `build` script.

```bash
# One package
npm run -w @mcpshield/gateway-core build
npm run -w @mcpshield/gateway-core test

# Self-hosted gateway from source (after root build)
node packages/cli/dist/index.js init     # writes mcpshield.yaml
node packages/cli/dist/index.js start    # /health and /mcp on :4000

# Hosted gateway
npm run -w mcp-security-gateway dev      # tsx watch, needs Supabase + Clerk env
docker build -f gateway/Dockerfile .     # build context is the repo root

# Dashboard (copies gateway/docs into content/docs first)
npm run -w mcp-security-dashboard dev    # :3001

# Demo MCP server
npm run -w partner-enablement-mcp-server build
TRANSPORT=http npm run -w partner-enablement-mcp-server start   # :3000, default is stdio
npm run -w partner-enablement-mcp-server inspect

# Demo web app (imports from mcp-server's build output, so build that first)
npm run -w partner-enablement-demo dev
```

## Architecture

### gateway-core (`packages/gateway-core/src/`)

Everything on the request hot path. Subpath exports: `storage`, `auth`, `security`, `policy`, `monitor`, `audit`, `config`, `proxy`, `webhooks`, `approval`, `packs`.

- **`proxy/engine.ts`**: `GatewayProxyEngine` uses the low-level MCP `Server` class. `createSessionServer(ctx)` makes one `Server` per client session, bound to that caller's `TenantContext`. Tools are exposed as `serverName__toolName`.
- **`proxy/connection-manager.ts`**: connects downstream servers over stdio or Streamable HTTP (static headers or OAuth via the factory port), discovers tools, resolves namespaced names by splitting on the first `__`.
- **`proxy/tool-interceptor.ts`**: the pipeline, in this order: billing guard, policy, approval gate, rate limit, request injection scan, request PII scan (detect only), drift check, forward, response injection scan (log only), response PII redaction, audit.
- **`proxy/ports.ts`**: the four cloud extension points (`AlertSink`, `BillingGuard`, `OAuthProviderFactory`, `AuditRecorder`) with no-op defaults.
- **`policy/engine.ts`**: rules sorted by priority, first match wins, default allow. Actions: `allow`, `deny`, `require_approval`, `log_only`. Server and tool conditions are picomatch globs. **Tool globs match the downstream tool name without the `server__` prefix** (use `servers:` to scope by server). 30s per-tenant cache.
- **`approval/`**: `require_approval` blocks and creates a pending request. The client retries with `arguments.__approvalId`. An approval only works for the same user, server, tool and arguments, and for `APPROVAL_EXECUTION_WINDOW_MS` (1h) after the admin decides. It is not single-use yet. The marker is always stripped before forwarding.
- **`security/`**: 4 scanner strategies (pattern-match, unicode, structural, exfiltration), PII registry, sliding-window rate limiter. Packs register extra strategies and PII patterns into global registries. Every request and response string runs through these patterns on the one event loop, so patterns must be linear-time: bound quantifiers and avoid a leading `.*` or unbounded `[...]+` before a required character. `security/__tests__/redos.test.ts` checks 200KB adversarial inputs.
- **`monitor/tool-snapshot.ts`**: SHA-256 drift detection. New params are critical (blocked), removed params are functional (alert), other changes are cosmetic (auto-approved).
- **`webhooks/`**: HMAC-SHA256 signed delivery with a private-address denylist.
- **`storage/`**: `StorageBackend` interface; `SqliteStorageBackend` (better-sqlite3, WAL) is the self-host impl.
- **`config/`**: zod schema for `mcpshield.yaml`, YAML loader, chokidar hot-reload (policies only; servers and packs need a restart).
- **`packs/loader.ts`**: dynamic-imports packs listed in config and registers their contributions.

Known gaps: `redactSecrets` and `requireMFA` modifiers are accepted but not enforced; there is no secrets scanner. Request PII is detected but never redacted.

### CLI (`packages/cli/src/`)

Hand-rolled arg parser in `index.ts`. Commands: `init`, `start`, `policy lint`, `key create`, `audit tail`, `alerts list`, `webhooks add|list|remove`, `servers list`, `policies list`, `approvals list`, `packs list`, `templates list|apply`. `lib/http-server.ts` serves `/health` and `/mcp` and passes the authenticated API-key principal into each session.

### Hosted gateway (`gateway/src/`)

A thin cloud shell around gateway-core. `index.ts` loads `@mcpshield/pack-atlassian`, then lazily creates one `GatewayProxyEngine` per tenant (idle engines evicted after 60 min, transports after 30 min).

- **`proxy/engine.ts`**: passes `allowStdio: false` (tenants must never run commands inside the shared gateway; `schemas/` also only accepts `transport: "http"`) and plugs in `CloudAlertSink` (+ core `WebhookAlertSink`), `CloudBillingGuard`, `CloudOAuthProviderFactory`, and `AuditLogger` (runs pack enrichers, feeds `UsageMeter`).
- **`storage/supabase.ts`**: `SupabaseStorageBackend` over `db/queries/*`. Config-as-code methods throw.
- **`auth/middleware.ts`**: `Bearer mgw_...` API keys (SHA-256 lookup, role `member`) or Clerk JWTs. Users resolve to a tenant via `tenant_users`; unknown Clerk users are auto-added to the default tenant `00000000-0000-0000-0000-000000000001` as `viewer`. Users listed in `DEMO_CLERK_USER_IDS` are always `viewer`.
- **`auth/viewer-access.ts`**: the `viewer` role is enforced inside `requireAuth`, so every route is covered. It's an allowlist of reads (`VIEWER_ALLOWED_READS`) plus `POST /api/policies/simulate`, matched against a normalized path (lowercased, trailing slash stripped) because Express routing ignores case and trailing slashes. Everything else, including `/mcp`, returns 403 `{ code: "read_only" }`. A new route stays closed to viewers until you add it to the allowlist; never add routes that return secrets or have side effects on GET. `requireRole` additionally guards team, API-key and approve/reject routes. Approve/reject is owner/admin only, and also refuses API-key callers and the request's own author; an expired request can't be approved.
- **`routes/mcp-proxy.ts`**: each MCP session is bound to the tenant and user that opened it; other callers presenting the same `mcp-session-id` get 403. The CLI server does the same.
- **`routes/`**: 16 routers registered in `routes/index.ts`: mcp-proxy (`/mcp`), servers, policies, policy-simulator, audit, alerts, snapshots, health, oauth, api-keys, team, approvals, webhooks, templates, billing, dashboard. Server responses go through `toPublicServer()`, an explicit field allowlist that drops OAuth secrets and stdio command/args, redacts header/env values, and strips credentials from the URL (userinfo, query values, fragment). `billing/json-body.ts` skips JSON parsing for the Stripe webhook so it gets the raw body.
- **`auth/server-oauth-provider.ts` + `routes/oauth.ts`**: PKCE OAuth to downstream servers (Atlassian Rovo). State nonce persisted in `mcp_servers.oauth_state_nonce`. Tokens encrypted with AES-256-GCM when `TOKEN_ENCRYPTION_KEY` is set.
- **`billing/`**: Stripe checkout/portal/webhook, plans (starter/pro/business/enterprise), `UsageMeter` flushing via `increment_usage` RPC.

**Database:** Supabase Postgres with RLS. Migrations in `gateway/supabase/migrations/` (001 to 010; 010 revokes all `anon`/`authenticated` access because only the gateway's service role should touch the database): tenants, tenant_users, mcp_servers, tool_snapshots, policy_rules, audit_logs, alerts, approval_requests, webhooks, api_keys, usage_meters, plus OAuth/auth-header columns.

**Deploy:** Railway, Dockerfile at `gateway/Dockerfile` built with the repo root as context (`gateway/railway.json`).

### Dashboard (`dashboard/src/`)

Next.js 14 App Router, Clerk auth (`middleware.ts`), talks to the gateway through `lib/api.ts` `gatewayFetch(path, token)` against `NEXT_PUBLIC_GATEWAY_API_URL`.

Public demo login: `/sign-in` shows **Try the demo** when `DEMO_CLERK_USER_ID` is set. `app/api/demo-login/route.ts` first asks the gateway (`GET /api/demo/viewer-check`) whether it forces that user to read-only and refuses otherwise, turns off Clerk self-deletion for the demo user, then mints a 2-minute Clerk sign-in token and redirects to `(auth)/demo/page.tsx`, which redeems it with the `ticket` strategy. `lib/viewer.tsx` (`ViewerProvider`, `useReadOnly()`, `useReadOnlyReason()`) loads `/api/me`. It fails closed: read-only until `/api/me` says otherwise. `/api/me` returns `demo: true` only for the shared demo user; other viewers (new sign-ups) get neutral read-only copy and keep Clerk's `UserButton`. Read-only users get `DemoBanner` and no write controls. The gateway is what actually enforces read-only; the UI only hides controls. When adding a page with write actions, hide them behind `useReadOnly()`.

Routes: `/sign-in`, `/sign-up`, `/demo` (public), `/` (overview), `/servers` (list, `new`, `[id]` with tool inventory, drift snapshots, OAuth status), `/policies` (list, `new`, `simulator`), `/tools`, `/approvals`, `/audit`, `/alerts`, `/settings` (API keys, team, billing), `/docs/[[...slug]]` (renders `gateway/docs`), `/onboarding`.

### Demo MCP server (`mcp-server/src/`)

`index.ts` wires transports (stdio default; `TRANSPORT=http` gives Express with `/mcp` and `/health`). Tools live in `tools/*.ts` and are registered from `tools/index.ts`:

- `partner_read_project_context` (Jira)
- `partner_generate_reference_architecture` (knowledge base)
- `partner_assess_compliance` (knowledge base)
- `partner_create_implementation_plan` (knowledge base)

Each returns `{ content, structuredContent }` with a `responseFormat` of markdown or json. `services/jiraClient.ts` has the real Jira Cloud v3 client and `MockJiraClient` (HEALTH, CLAIMS, FINSERV). `services/knowledgeBase.ts` lazy-loads `knowledge/*.json` with `readFileSync`. The JSON currently covers compliance frameworks hipaa, soc2 and fedramp, and industries healthcare and financial_services; the zod enums in `schemas/index.ts` allow more values than the data covers.

### Demo web app (`web-demo/src/`)

Single page (`app/page.tsx`, client component) that switches by state between 4 workflows (Deployment Planning, Knowledge Base Audit, Sprint Operations, Risk Radar) and two standalone views (Security Threat Simulator, Governance Control Room). Step components live in `components/steps/`, workflow config in `lib/constants.ts`.

- **`lib/gateway-client.ts`**: raw JSON-RPC to `${GATEWAY_URL}/mcp` with `GATEWAY_API_KEY`; opens a session per call; prefixes tool names with `${ROVO_SERVER_NAME}__`.
- **`app/api/tools/*`**: 24 routes. Most call Rovo tools through the gateway and fall back to mock data on failure. `create-plan`, `health-scoring`, `risk-scoring` and `security-scan` run locally. Shared helpers in `_shared.ts` and `_rateLimit.ts` (in-memory, per instance).
- **`app/api/dashboard-hub/knowledge-health/`**: JSON + `bars.svg`, `pie.svg`, `heatmap.svg` for the Dashboard Hub Pro gadget and the Rovo agent in `docs/rovo-agents/knowledge-health-auditor.md`. Bearer `DASHBOARD_HUB_API_TOKEN`; `DASHBOARD_HUB_PUBLIC=true` disables auth.
- Imports schemas, `MockJiraClient`, `KnowledgeBase` and knowledge JSON from `partner-enablement-mcp-server`; `vercel.json` builds mcp-server first.

`docs/` (ARCHITECTURE, VIDEO_SCRIPT, prd/) are the original Feb 2026 planning docs for the demo and predate MCPShield.

## Environment Variables

```bash
# Hosted gateway (gateway/)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CLERK_SECRET_KEY=                 # "dev" + NODE_ENV=development skips Clerk
PORT=4000
LOG_LEVEL=info
ALLOWED_ORIGINS=                  # comma-separated; *.vercel.app is always allowed
OAUTH_CALLBACK_BASE_URL=
TOKEN_ENCRYPTION_KEY=             # without it OAuth tokens are stored in plaintext
TOKEN_ENCRYPTION_SALT=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_BUSINESS_PRICE_ID=
DEMO_CLERK_USER_IDS=              # Clerk user ids forced to read-only viewer (DEMO_CLERK_USER_ID also accepted)
AUDIT_BATCH_SIZE= AUDIT_FLUSH_INTERVAL_MS= POLICY_CACHE_TTL_MS=

# Dashboard (dashboard/)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_GATEWAY_API_URL=http://localhost:4000
DEMO_CLERK_USER_ID=               # optional; enables "Try the demo" on /sign-in

# Demo MCP server (mcp-server/). Without Jira vars it uses MockJiraClient.
JIRA_HOST= JIRA_EMAIL= JIRA_API_TOKEN=
TRANSPORT=stdio                   # or http
PORT=3000

# Demo web app (web-demo/)
GATEWAY_URL=                      # hosted gateway base URL
GATEWAY_API_KEY=                  # mgw_... key for the demo tenant
ROVO_SERVER_NAME=atlassian-rovo
ATLASSIAN_CLOUD_ID=
NEXT_PUBLIC_DEMO_PROJECT_KEY_HEALTH=
NEXT_PUBLIC_DEMO_PROJECT_KEY_FINSERV=
DASHBOARD_HUB_API_TOKEN=          # 32-byte hex, used by Dashboard Hub Pro + Rovo agent
DASHBOARD_HUB_PUBLIC=             # "true" disables auth on knowledge-health (testing only)
```

## Tool Usage

- Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Execution Strategy

When given a multi-step plan where tasks are independent, prefer parallel subagent execution over sequential execution. Always check for task dependencies before running sequentially.

## Code Conventions

- TypeScript strict mode, ES modules (`"type": "module"`, `.js` extensions in relative imports).
- Zod for runtime validation at system boundaries, `.strict()` on input schemas.
- MCP tool responses return `{ content: [{ type: "text", text }], structuredContent }`, or `{ isError: true, content }` on failure.
- `gateway-core` must never import from `gateway/` or `dashboard/`. Cloud behavior plugs in through `proxy/ports.ts`.
- Packs contribute data and small functions (PII regexes, enrichers, templates). They don't reach into core internals.
- Tests are vitest, in `src/**/__tests__/`. New behavior gets a test.
- Copy style: no em dashes, no filler vocabulary ("leverage", "seamless", "robust", etc.). Write plainly.
