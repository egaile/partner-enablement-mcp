# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Partner Enablement MCP Server — a demonstration MCP server that helps GSIs (Global System Integrators) operationalize Claude deployments in enterprise environments. Built as a portfolio piece for an Anthropic Partner Solutions Architect application.

Four packages in one monorepo:
- **`mcp-server/`** — TypeScript MCP server (stdio + HTTP transport)
- **`web-demo/`** — Next.js 14 app that simulates the MCP experience for non-technical viewers
- **`gateway/`** — MCP Security Gateway proxy engine (Express + MCP SDK)
- **`dashboard/`** — Next.js 14 admin dashboard for the gateway (Clerk + Supabase)

## Development Commands

```bash
# MCP Server
cd mcp-server
npm install
npm run build          # tsc → dist/
npm run dev            # tsx watch src/index.ts
npm start              # node dist/index.js (stdio mode)
TRANSPORT=http npm start  # HTTP mode on PORT (default 3000)
npm run inspect        # npx @modelcontextprotocol/inspector

# Web Demo
cd web-demo
npm install
npm run dev            # Next.js dev server
npm run build          # Production build
npm run lint           # next lint

# Gateway
cd gateway
npm install
npm run build          # tsc → dist/
npm run dev            # tsx watch src/index.ts
npm start              # node dist/index.js
npm test               # vitest

# Dashboard
cd dashboard
npm install
npm run dev            # Next.js dev on :3001
npm run build          # Production build
```

## Architecture

### MCP Server (`mcp-server/src/`)

Single-file server in `index.ts` registers 4 tools via `McpServer.registerTool()` from `@modelcontextprotocol/sdk`. All tool handlers are defined inline in `index.ts` (no separate tool files despite README suggesting otherwise).

**Tool pipeline:** Each tool receives Zod-validated params → calls services (Jira + KnowledgeBase) → returns `{ content, structuredContent }` supporting both markdown and JSON `responseFormat`.

Key services:
- **`services/jiraClient.ts`** — `JiraClient` (real Jira Cloud REST v3) + `MockJiraClient` (hardcoded HEALTH/CLAIMS projects). `createJiraClient()` factory auto-selects based on env vars.
- **`services/knowledgeBase.ts`** — Singleton `KnowledgeBase` class that lazy-loads JSON files from `knowledge/` directory. Provides pattern recommendation via keyword matching (`recommendPattern`), compliance framework lookup, and industry use case matching.

**Knowledge base files** (`knowledge/*.json`): `architectures.json` (patterns: rag_document_qa, conversational_agent, batch_processing, human_in_the_loop), `compliance.json` (frameworks: hipaa, soc2, fedramp, pci_dss, gdpr, ccpa), `industries.json` (healthcare, financial_services, education, public_sector).

**Schemas** (`schemas/index.ts`): All input/output schemas defined with Zod. Input schemas use `.strict()`. Key enums: `IndustryVertical`, `CloudProvider`, `ComplianceFramework`, `ArchitecturePattern`, `ResponseFormat`.

**Transport:** `index.ts` bottom selects stdio vs HTTP based on `TRANSPORT` env var. HTTP mode uses Express with `StreamableHTTPServerTransport` on `/mcp` endpoint and `/health` for healthcheck.

### Web Demo (`web-demo/`)

Next.js 14 App Router app. Main orchestration in `src/app/page.tsx` (client component). Calls the MCP Security Gateway via `lib/gateway-client.ts` to exercise live Atlassian Rovo MCP tools (Jira + Confluence). Falls back to realistic mock data when the gateway is unavailable. 11 API routes under `src/app/api/tools/` proxy tool calls through the gateway. Uses Tailwind CSS + lucide-react icons.

### Gateway (`gateway/src/`)

MCP Security Gateway — a transparent proxy that sits between AI agents and downstream MCP servers. Uses the low-level `Server` class (not `McpServer`) to intercept raw JSON-RPC `tools/list` and `tools/call` messages.

**Proxy flow:** Auth (Clerk) → Policy evaluation → Injection scan → Drift check → Forward to downstream → Scan response → Audit log

Key subsystems:
- **`proxy/engine.ts`** — `GatewayProxyEngine`: creates MCP Server, registers ListTools/CallTool handlers, manages downstream connections
- **`proxy/connection-manager.ts`** — `ConnectionManager`: connects to downstream MCP servers via stdio or HTTP, discovers tools, resolves namespaced tool names (`serverName__toolName`)
- **`proxy/tool-interceptor.ts`** — `ToolInterceptor`: orchestrates the 9-step security pipeline per tool call
- **`policy/engine.ts`** — `PolicyEngine`: evaluates rules from Supabase with LRU cache (30s TTL), picomatch for glob matching
- **`security/scanner.ts`** — `PromptInjectionScanner`: runs 4 strategies (pattern-match, unicode, structural, exfiltration) against all string values in tool params
- **`monitor/tool-snapshot.ts`** — SHA-256 hash comparison for tool definition drift detection
- **`audit/logger.ts`** — `AuditLogger`: buffered writes (batch 50 or every 5s) to Supabase `audit_logs`
- **`alerts/engine.ts`** — `AlertEngine`: fires alerts for injections, drift, policy violations
- **`auth/middleware.ts`** — Express middleware: Clerk token → tenant lookup → `AuthenticatedRequest`
- **`db/queries/`** — Supabase query modules for tenants, servers, policies, audit, snapshots, alerts

**Database:** Supabase Postgres with RLS. Schema in `gateway/supabase/migrations/001_initial_schema.sql`. Tables: tenants, tenant_users, mcp_servers, tool_snapshots, policy_rules, audit_logs, alerts.

### Dashboard (`dashboard/src/`)

Next.js 14 admin dashboard for the gateway. Uses Clerk for auth, fetches data from the gateway REST API.

**Pages:** Dashboard home (metrics), Servers (list/add/detail+tool inventory), Policies (list/create), Audit log (paginated table), Alerts (feed with acknowledge), Settings.

**Components:** `layout/Sidebar.tsx` + `TopBar.tsx`, `dashboard/MetricCard.tsx` + `RecentActivity.tsx`, `servers/ServerCard.tsx` + `ToolInventory.tsx`, `policies/RuleBuilder.tsx`, `audit/LogTable.tsx`, `alerts/AlertFeed.tsx`.

## Environment Variables

```bash
# MCP Server — Jira (optional — falls back to MockJiraClient with demo data)
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
PORT=3000              # HTTP mode port
TRANSPORT=stdio        # "stdio" or "http"

# Gateway
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CLERK_SECRET_KEY=
PORT=4000
LOG_LEVEL=info

# Dashboard
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
GATEWAY_API_URL=http://localhost:4000
```

## Tool Usage

- Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Execution Strategy

When given a multi-step plan where tasks are independent, prefer parallel subagent execution over sequential execution. Always check for task dependencies before running sequentially.

## Code Conventions

- TypeScript strict mode, ES modules (`"type": "module"` in package.json, `.js` extensions in imports)
- Zod for all runtime validation with `.strict()` on input schemas
- All MCP tool responses return `{ content: [{ type: "text", text }], structuredContent }` or `{ isError: true, content }` on failure
- Knowledge base uses lazy-loaded JSON files with `readFileSync` (not async)
