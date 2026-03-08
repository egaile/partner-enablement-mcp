# Getting Started

Get the MCP Security Gateway running locally in 5 minutes. By the end of this guide you will have the gateway proxying tool calls to a downstream MCP server with a basic deny policy in place.

## Prerequisites

- Node.js 18 or later
- A Supabase project (free tier works)
- A Clerk application (free tier works)

## 1. Clone and install

```bash
git clone <repo-url>
cd partner-enablement-mcp/gateway
npm install
```

## 2. Set up Supabase

Create a Supabase project at [supabase.com](https://supabase.com). Then run the migration files in order against your database using the Supabase SQL editor or CLI:

```bash
# If using the Supabase CLI:
supabase db push
```

Or paste each file from `gateway/supabase/migrations/` into the SQL editor in order:

1. `001_initial_schema.sql` -- core tables, RLS policies
2. `002_approval_requests.sql` -- HITL approval workflow
3. `003_webhooks.sql` -- webhook notification channels
4. `004_api_keys.sql` -- programmatic API key access
5. `005_billing.sql` -- billing plans, usage metering, Stripe integration
6. `006_server_auth_headers.sql` -- auth headers for downstream servers
7. `007_server_oauth.sql` -- OAuth 2.1 token storage for downstream servers

After running migrations, seed a default tenant:

```sql
INSERT INTO tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default');

INSERT INTO tenant_users (tenant_id, clerk_user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'dev_user', 'owner');
```

## 3. Configure environment

Create a `.env` file in the `gateway/` directory:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
CLERK_SECRET_KEY=dev
PORT=4000
LOG_LEVEL=info
```

Setting `CLERK_SECRET_KEY=dev` enables dev mode, which skips Clerk token verification and maps all requests to the `dev_user` seeded above. This is the fastest way to get started locally.

## 4. Start the gateway

```bash
npm run dev
```

You should see:

```
MCP Security Gateway running on http://localhost:4000
  MCP proxy: POST /mcp
  REST API:  /api/*
  Health:    GET /health
```

Verify it is running:

```bash
curl http://localhost:4000/health
# {"status":"healthy","service":"mcp-security-gateway"}
```

## 5. Register your first downstream server

Register an MCP server for the gateway to proxy. This example registers an HTTP-transport server:

```bash
curl -X POST http://localhost:4000/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-mcp-server",
    "transport": "http",
    "url": "http://localhost:3000/mcp",
    "enabled": true
  }'
```

For a stdio-transport server:

```bash
curl -X POST http://localhost:4000/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "filesystem-server",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    "enabled": true
  }'
```

The gateway automatically connects to enabled servers, discovers their tools, and namespaces them as `serverName__toolName`.

## 6. Test the MCP proxy

Send an MCP `tools/list` request through the gateway:

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "clientInfo": { "name": "test", "version": "1.0" },
      "capabilities": {}
    }
  }'
```

Note the `mcp-session-id` header in the response. Use it for subsequent requests:

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <session-id-from-above>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

You should see all tools from your downstream servers, prefixed with their server name.

## 7. Create your first policy

Block a specific tool:

```bash
curl -X POST http://localhost:4000/api/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Block dangerous tool",
    "priority": 100,
    "conditions": {
      "tools": ["delete_*"]
    },
    "action": "deny",
    "enabled": true
  }'
```

Now any tool call matching `delete_*` will be blocked and logged. Check the audit log:

```bash
curl http://localhost:4000/api/audit?limit=10
```

## What's next

- [Connecting Servers](./connecting-servers.md) -- detailed guide for HTTP and stdio servers
- [Connecting Atlassian Rovo](./connecting-atlassian-rovo.md) -- connect Jira and Confluence via the Rovo MCP Server
- [Policy Rules](./policy-rules.md) -- full policy DSL reference with examples
- [Dashboard Walkthrough](./dashboard-walkthrough.md) -- visual management via the admin UI
- [Deployment](../admin/deployment.md) -- deploy to Railway and Vercel
