# Partner Enablement MCP

A comprehensive demonstration of how Global System Integrators can operationalize AI agent deployments using Model Context Protocol (MCP) with enterprise-grade security. Features a live integration with Atlassian Rovo MCP Server (14 Jira + Confluence tools), an MCP Security Gateway with injection scanning, policy enforcement, PII detection, and audit logging, plus an admin dashboard for governance.

## Components

| Package | Description | Stack |
|---------|-------------|-------|
| [`mcp-server/`](#mcp-server) | MCP server connecting Claude to Jira workflows and knowledge base | TypeScript, MCP SDK |
| [`web-demo/`](#web-demo) | Interactive demo exercising 14 Rovo MCP tools through the gateway | Next.js 14, Tailwind |
| [`gateway/`](#mcp-security-gateway) | Transparent MCP proxy with security pipeline | Express, MCP SDK |
| [`dashboard/`](#admin-dashboard) | Admin dashboard for gateway governance | Next.js 14, Clerk, shadcn/ui |

## Architecture

```
+---------------------------------------------------------------+
|                        AI CLIENTS                              |
|  Claude Desktop / Claude Code / Cursor / VS Code / Web Demo   |
+---------------------------------------------------------------+
                            |
                    MCP JSON-RPC
                            |
+---------------------------------------------------------------+
|                  MCP SECURITY GATEWAY                          |
|                                                                |
|  Auth (Clerk/API Key) --> Usage Limits --> Policy Engine       |
|       --> Rate Limiter --> Injection Scanner (5 strategies)    |
|       --> PII Detector --> Drift Check --> Forward to Server   |
|       --> Response Scan --> PII Redact --> Audit Log           |
|                                                                |
|  + HITL Approval Engine    + Webhook Dispatcher                |
|  + Atlassian Audit Enricher  + Health Checker                  |
+---------------------------------------------------------------+
                            |
                    MCP JSON-RPC
                            |
+---------------------------------------------------------------+
|              ATLASSIAN ROVO MCP SERVER                         |
|                                                                |
|  40+ tools across Jira, Confluence, and Compass                |
|  Auth: API Token (Basic) or OAuth 2.1 (PKCE)                  |
+---------------------------------------------------------------+
                            |
                   REST API
                            |
+---------------------------------------------------------------+
|           ATLASSIAN CLOUD                                      |
|  Jira Cloud  |  Confluence Cloud  |  Compass                  |
+---------------------------------------------------------------+
```

## Quick Start

### Prerequisites

- Node.js >= 18
- npm

### Install

```bash
npm install          # installs all workspaces from root
```

### Run the Web Demo

```bash
cd web-demo
npm run dev          # Next.js dev server on :3000
```

### Run the Gateway

```bash
cd gateway
npm run dev          # Express server on :4000
```

### Run the Dashboard

```bash
cd dashboard
npm run dev          # Next.js dev server on :3001
```

---

## MCP Server

The MCP server (`mcp-server/`) registers 4 tools via `McpServer.registerTool()` from `@modelcontextprotocol/sdk`. It connects to Jira Cloud for live project data and uses a local knowledge base for architecture patterns, compliance frameworks, and industry templates.

### Tools

| Tool | Description |
|------|-------------|
| `partner_read_project_context` | Reads Jira project backlog, detects compliance signals, integration targets, and data types |
| `partner_generate_reference_architecture` | Generates compliant reference architectures with pattern selection and service mappings |
| `partner_assess_compliance` | Analyzes project context for regulatory frameworks (HIPAA, SOC2, PCI-DSS, etc.) |
| `partner_create_implementation_plan` | Creates phased delivery plans with sprint structures, milestones, and Jira ticket templates |

### Running

```bash
cd mcp-server
npm run build
npm start                  # stdio mode (default)
TRANSPORT=http npm start   # HTTP mode on PORT (default 3000)
npm run inspect            # MCP Inspector for debugging
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "partner-enablement": {
      "command": "node",
      "args": ["/path/to/partner-enablement-mcp/mcp-server/dist/index.js"],
      "env": {
        "JIRA_HOST": "your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

---

## Web Demo

The web demo (`web-demo/`) is a Next.js 14 application that exercises 14 Atlassian Rovo MCP tools through the MCP Security Gateway. It demonstrates the full lifecycle of an AI agent analyzing enterprise data with security guardrails.

### Demo Flow (7 Steps)

1. **Project Context** -- Reads Jira backlog via `getVisibleJiraProjects` + `searchJiraIssuesUsingJql`, with expandable issue details via `getJiraIssue`
2. **Cross-Product Search** -- Searches across Jira and Confluence using Rovo Search (`search`), with JQL fallback
3. **Project Health** -- Runs 4 parallel JQL queries to assess readiness (overdue, blocked, critical issues)
4. **Architecture** -- Searches Confluence for existing architecture docs via CQL (`searchConfluenceUsingCql`), reads top matches (`getConfluencePage`), recommends patterns
5. **Compliance** -- Searches Confluence per applicable compliance framework, identifies doc coverage gaps
6. **Implementation Plan** -- Generates phased plan with sprint timelines and Jira ticket templates
7. **Agent Actions** -- Executes write operations: label issues (`editJiraIssue`), add comments (`addCommentToJiraIssue`), transition statuses (`transitionJiraIssue`), create Confluence pages, create Jira tickets

### Rovo Tools Used

| Tool | Steps | Type |
|------|-------|------|
| `getAccessibleAtlassianResources` | 1-7 | Read |
| `getVisibleJiraProjects` | 1 | Read |
| `searchJiraIssuesUsingJql` | 1, 3 | Read |
| `getJiraIssue` | 1 | Read |
| `search` (Rovo) | 2 | Read |
| `searchConfluenceUsingCql` | 4, 5 | Read |
| `getConfluencePage` | 4 | Read |
| `editJiraIssue` | 7 | Write |
| `addCommentToJiraIssue` | 7 | Write |
| `transitionJiraIssue` | 7 | Write |
| `createConfluencePage` | 7 | Write |
| `createJiraIssue` | 7 | Write |
| `getConfluenceSpaces` | 7 | Read |
| `getJiraProjectIssueTypesMetadata` | 7 | Read |

### Features

- **Security Pipeline Visualization** -- Animated 7-stage pipeline showing auth, policy, injection scan, PII detect, forward, response scan, and audit log
- **Live Audit Trail** -- Slide-out panel showing real-time gateway audit entries with Atlassian-specific metadata
- **Tool Reference Panel** -- Catalog of 40+ Rovo tools grouped by category with risk level badges
- **Architecture Diagram** -- Visual flow diagram on the landing page explaining the MCP + Gateway architecture
- **Security Callouts** -- Contextual educational notes (PII detection, Confluence CQL, write policy blocks)
- **Mock Fallback** -- All steps work with realistic mock data when the gateway is unavailable

### Scenarios

| Industry | Project Key | Compliance | Integrations |
|----------|-------------|------------|--------------|
| Healthcare | HEALTH | HIPAA | Epic EHR, FHIR |
| Financial Services | FINSERV | SOC2, PCI-DSS | Loan processing |

---

## MCP Security Gateway

The gateway (`gateway/`) is a transparent MCP proxy that sits between AI clients and downstream MCP servers. It intercepts every `tools/list` and `tools/call` JSON-RPC message and applies a multi-stage security pipeline.

### Security Pipeline

```
Auth --> Usage Limit --> Policy --> Rate Limit --> Injection Scan
  --> PII Detect --> Drift Check --> Forward --> Response Scan
  --> PII Redact --> Audit Log
```

### Key Features

- **5 Injection Scanner Strategies** -- Pattern matching, Unicode analysis, structural analysis, exfiltration detection, and 20 Atlassian-specific patterns
- **PII Detection** -- Luhn-validated credit cards, SSN, email, phone, IP, DOB, MRN
- **Policy Engine** -- Allow, deny, require_approval, log_only actions with glob matching
- **HITL Approval Engine** -- Pending approval requests with expiration
- **Tool Drift Detection** -- SHA-256 hash comparison alerts on tool definition changes
- **Rate Limiting** -- Sliding window per tenant:user:server:tool
- **Health Checking** -- Periodic `listTools` ping with alert after 3 consecutive failures
- **Webhook Dispatcher** -- HMAC-SHA256 signed delivery for alerts and events
- **Atlassian Audit Enricher** -- Extracts Jira project keys, Confluence space keys, operation types
- **Billing & Usage Metering** -- 4 tiers (Starter/Pro/Business/Enterprise) with Stripe integration
- **OAuth 2.1** -- MCP SDK-based OAuth with PKCE, auto-refresh, dynamic client registration
- **6 Atlassian Policy Templates** -- Read-Only Jira, Protected Projects, Approval for Writes, Confluence View-Only, Audit Everything, PII Shield

### Running

```bash
cd gateway
npm run build
npm start              # Express on PORT (default 4000)
npm test               # 121 tests across 7 test files
```

### API Reference

See [`gateway/docs/api/README.md`](gateway/docs/api/README.md) for the full REST API reference covering servers, policies, audit, alerts, approvals, webhooks, OAuth, billing, and API keys.

### Connecting Atlassian Rovo

See [`gateway/docs/guides/connecting-atlassian-rovo.md`](gateway/docs/guides/connecting-atlassian-rovo.md) for step-by-step setup with API tokens or OAuth 2.1.

---

## Admin Dashboard

The dashboard (`dashboard/`) is a Next.js 14 application providing a management UI for the gateway. Built with Clerk for authentication and shadcn/ui for components.

### Pages

| Page | Description |
|------|-------------|
| Dashboard | Metrics overview (total calls, blocked, threats, latency) |
| Servers | List/add/detail MCP servers with tool inventory |
| Policies | Create rules with glob matching and action selection |
| Policy Simulator | Test policy evaluation without making real tool calls |
| Tools | Browse all discovered tools across connected servers |
| Approvals | Review and approve/reject pending HITL requests |
| Audit Log | Paginated, filterable audit trail |
| Alerts | Feed with acknowledge and bulk actions |
| Settings | Account, Team, API Keys, Billing, Gateway, General |
| Onboarding | 4-step Atlassian-first wizard |

### Running

```bash
cd dashboard
npm run dev          # Next.js on :3001
```

---

## Environment Variables

```bash
# MCP Server
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
PORT=3000
TRANSPORT=stdio              # "stdio" or "http"

# Gateway
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CLERK_SECRET_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PORT=4000
LOG_LEVEL=info
ALLOWED_ORIGINS=             # CORS origins

# Dashboard
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
GATEWAY_API_URL=http://localhost:4000

# Web Demo
NEXT_PUBLIC_GATEWAY_URL=     # Gateway URL for live mode
GATEWAY_API_KEY=             # mgw_ prefixed API key
NEXT_PUBLIC_DEMO_PROJECT_KEY_HEALTH=HEALTH
NEXT_PUBLIC_DEMO_PROJECT_KEY_FINSERV=FINSERV
```

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Web Demo | Vercel | [partner-enablement-mcp.vercel.app](https://partner-enablement-mcp.vercel.app) |
| Gateway | Railway | gateway-production-b077.up.railway.app |
| Dashboard | Vercel | Linked from repo root |
| Database | Supabase | PostgreSQL with RLS |

## Project Structure

```
partner-enablement-mcp/
+-- package.json                 # npm workspaces root
+-- CLAUDE.md                    # Claude Code project instructions
+-- mcp-server/
|   +-- src/
|   |   +-- index.ts             # MCP server (4 tools inline)
|   |   +-- services/            # JiraClient, KnowledgeBase
|   |   +-- schemas/             # Zod input/output schemas
|   |   +-- knowledge/           # JSON knowledge base files
|   +-- package.json
+-- web-demo/
|   +-- src/
|   |   +-- app/
|   |   |   +-- page.tsx         # Main demo page (client component)
|   |   |   +-- api/tools/       # 8 API routes (gateway proxies)
|   |   +-- components/
|   |   |   +-- steps/           # 7 step components + CompleteStep
|   |   |   +-- SecurityPipeline.tsx
|   |   |   +-- AuditTrailPanel.tsx
|   |   |   +-- ToolReferencePanel.tsx
|   |   |   +-- ArchitectureDiagram.tsx
|   |   +-- lib/
|   |   |   +-- gateway-client.ts  # MCP JSON-RPC client
|   |   |   +-- rovo-tools.ts      # 40+ tool catalog
|   |   +-- types/api.ts          # Shared TypeScript types
|   +-- package.json
+-- gateway/
|   +-- src/
|   |   +-- index.ts             # Express server + routes
|   |   +-- proxy/               # GatewayProxyEngine, ConnectionManager
|   |   +-- security/            # InjectionScanner, PiiScanner
|   |   +-- policy/              # PolicyEngine
|   |   +-- audit/               # AuditLogger, AtlassianEnricher
|   |   +-- auth/                # Clerk, API key, OAuth, role guard
|   |   +-- billing/             # UsageMeter, PlanCache, Stripe
|   |   +-- alerts/              # AlertEngine
|   |   +-- monitor/             # ToolSnapshot, HealthChecker
|   |   +-- db/queries/          # Supabase query modules
|   +-- supabase/migrations/     # 7 migration files
|   +-- docs/                    # 14 documentation files
|   +-- package.json
+-- dashboard/
|   +-- src/
|   |   +-- app/                 # 16 routes (App Router)
|   |   +-- components/          # Layout, servers, policies, audit, alerts
|   |   +-- lib/                 # API client, utilities
|   +-- package.json
```

## Author

Ed Gaile -- Principal Solutions Architect
- LinkedIn: [linkedin.com/in/edgaile](https://linkedin.com/in/edgaile)
- GitHub: [github.com/egaile](https://github.com/egaile)

## License

MIT
