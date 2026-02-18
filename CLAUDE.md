# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Partner Enablement MCP Server — a demonstration MCP server that helps GSIs (Global System Integrators) operationalize Claude deployments in enterprise environments. Built as a portfolio piece for an Anthropic Partner Solutions Architect application.

Two independent packages in one repo:
- **`mcp-server/`** — TypeScript MCP server (stdio + HTTP transport)
- **`web-demo/`** — Next.js 14 app that simulates the MCP experience for non-technical viewers

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

Single-page Next.js 14 App Router app. All logic is in `src/app/page.tsx` — a client component with simulated streaming (character-by-character reveal of hardcoded markdown content). No actual MCP or Claude API calls; purely for demonstration. Uses Tailwind CSS + lucide-react icons.

## Environment Variables

```bash
# Jira (optional — falls back to MockJiraClient with demo data)
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token

# Server
PORT=3000              # HTTP mode port
TRANSPORT=stdio        # "stdio" or "http"
```

## Code Conventions

- TypeScript strict mode, ES modules (`"type": "module"` in package.json, `.js` extensions in imports)
- Zod for all runtime validation with `.strict()` on input schemas
- All MCP tool responses return `{ content: [{ type: "text", text }], structuredContent }` or `{ isError: true, content }` on failure
- Knowledge base uses lazy-loaded JSON files with `readFileSync` (not async)
