# API Reference

The MCP Security Gateway exposes a REST API for management operations and an MCP proxy endpoint for tool calls. All endpoints except `/health` require authentication.

**Base URL:** `http://localhost:4000` (local) or `https://gateway-production-b077.up.railway.app` (production)

## Authentication

Every request (except `GET /health`) must include one of:

### Clerk Bearer Token

```
Authorization: Bearer <clerk-jwt>
```

Clerk JWTs are short-lived (typically 60 seconds). The dashboard handles token refresh automatically. For programmatic use, obtain a token from Clerk's SDK.

### API Key

```
X-API-Key: mgw_<32 hex chars>
```

API keys are created via `POST /api/settings/api-keys`. The raw key is shown once at creation time and cannot be retrieved again. Keys are stored as SHA-256 hashes.

### Dev Mode

When `CLERK_SECRET_KEY=dev`, authentication is bypassed. All requests are mapped to `dev_user` in the default tenant. Do not use in production.

## Response format

All responses are JSON. Successful responses return the requested data. Errors return:

```json
{
  "error": "Description of what went wrong"
}
```

Validation errors return the Zod issue array:

```json
{
  "error": [
    { "code": "too_small", "path": ["name"], "message": "String must contain at least 1 character(s)" }
  ]
}
```

---

## Health

### GET /health

Unauthenticated. Returns gateway health status.

**Response:**
```json
{ "status": "healthy", "service": "mcp-security-gateway" }
```

---

## MCP Proxy

### ALL /mcp

The MCP proxy endpoint. Accepts JSON-RPC requests conforming to the Model Context Protocol.

**Session lifecycle:**
1. Send a `POST /mcp` with an `initialize` request. The response includes an `mcp-session-id` header.
2. Include `mcp-session-id: <id>` in all subsequent requests to reuse the session.
3. Sessions are cleaned up after 30 minutes of inactivity.

**Supported methods:**
- `initialize` -- start a new session
- `tools/list` -- list all tools from connected downstream servers (namespaced as `serverName__toolName`)
- `tools/call` -- call a tool through the security pipeline

---

## Servers

### GET /api/servers

List all registered MCP servers for the authenticated tenant.

**Response:**
```json
{
  "servers": [
    {
      "id": "uuid",
      "name": "my-server",
      "transport": "http",
      "url": "https://example.com/mcp",
      "command": null,
      "args": null,
      "env": null,
      "enabled": true,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/servers

Register a new downstream MCP server.

**Body:**
```json
{
  "name": "my-server",
  "transport": "http",
  "url": "https://example.com/mcp",
  "enabled": true
}
```

Or for stdio:
```json
{
  "name": "my-server",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
  "env": { "KEY": "value" },
  "enabled": true
}
```

**Validation:** `name` (1-100 chars, required), `transport` (`"http"` or `"stdio"`, required), `url` (valid URL, required for HTTP), `command` (required for stdio).

**Response:** `201 Created` with `{ "server": { ... } }`

### PUT /api/servers/:id

Update a server's configuration.

**Body:** Any subset of the fields from `POST /api/servers`.

**Response:** `{ "server": { ... } }`

### DELETE /api/servers/:id

Delete a server. Removes all associated snapshots.

**Response:** `{ "success": true }`

### GET /api/servers/:id/health

Get the health status of a connected server.

**Response:**
```json
{
  "serverId": "uuid",
  "serverName": "my-server",
  "status": "healthy",
  "latencyMs": 42,
  "consecutiveFailures": 0,
  "lastChecked": "2025-01-15T10:05:00Z"
}
```

Status values: `healthy`, `degraded`, `unreachable`.

---

## Tool Snapshots

### GET /api/servers/:serverId/snapshots

List tool definition snapshots for a server.

**Response:**
```json
{
  "snapshots": [
    {
      "id": "uuid",
      "toolName": "search_issues",
      "definitionHash": "abc123...",
      "definition": { "name": "search_issues", "description": "...", "inputSchema": {} },
      "approved": true,
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/servers/:serverId/snapshots/:snapshotId/approve

Approve a tool snapshot. Optionally update to a new hash.

**Body (optional):**
```json
{
  "newHash": "def456...",
  "newDefinition": { "name": "search_issues", "description": "Updated", "inputSchema": {} }
}
```

**Response:** `{ "success": true }`

---

## Policies

### GET /api/policies

List all policy rules for the tenant.

**Response:**
```json
{
  "policies": [
    {
      "id": "uuid",
      "name": "Block deletes",
      "description": null,
      "priority": 100,
      "conditions": { "tools": ["delete_*"] },
      "action": "deny",
      "modifiers": null,
      "enabled": true,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/policies

Create a new policy rule.

**Body:**
```json
{
  "name": "Block deletes",
  "description": "Prevent deletion operations",
  "priority": 100,
  "conditions": {
    "servers": ["*"],
    "tools": ["delete_*"],
    "users": [],
    "timeWindows": []
  },
  "action": "deny",
  "modifiers": {
    "redactPII": false,
    "maxCallsPerMinute": null
  },
  "enabled": true
}
```

**Validation:** `name` (1-200 chars, required), `priority` (0-10000, default 1000), `conditions` (object, required), `action` (one of `allow`, `deny`, `require_approval`, `log_only`, required).

**Response:** `{ "policy": { ... } }`

### PUT /api/policies/:id

Update a policy rule.

**Response:** `{ "policy": { ... } }`

### DELETE /api/policies/:id

Delete a policy rule.

**Response:** `{ "success": true }`

### POST /api/policies/simulate

Simulate policy evaluation and injection scanning without making a real tool call.

**Body:**
```json
{
  "serverName": "jira",
  "toolName": "delete_issue",
  "userId": "user_abc",
  "params": { "issueKey": "PROJ-42" }
}
```

**Response:**
```json
{
  "decision": "deny",
  "matchedRule": { "ruleId": "uuid", "ruleName": "Block deletes", "action": "deny" },
  "modifiers": {},
  "scanResult": { "clean": true, "threatCount": 0, "highestSeverity": null },
  "wouldBeBlocked": true,
  "reason": "Blocked by policy \"Block deletes\""
}
```

---

## Audit Logs

### GET /api/audit

Query audit log entries.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max entries to return. |
| `offset` | number | 0 | Pagination offset. |
| `serverId` | string | | Filter by server ID. |
| `toolName` | string | | Filter by tool name. |
| `startDate` | string | | ISO 8601 start date. |
| `endDate` | string | | ISO 8601 end date. |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "correlationId": "uuid",
      "userId": "user_abc",
      "serverId": "uuid",
      "serverName": "jira",
      "toolName": "search_issues",
      "policyDecision": "allow",
      "policyRuleId": null,
      "threatsDetected": 0,
      "driftDetected": false,
      "requestPiiDetected": false,
      "responsePiiDetected": false,
      "latencyMs": 142,
      "success": true,
      "errorMessage": null,
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

### GET /api/audit/metrics

Get aggregated metrics for the dashboard.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `since` | string | 24 hours ago | ISO 8601 start date for metrics window. |

**Response:**
```json
{
  "totalCalls": 1250,
  "blockedCalls": 23,
  "threatsDetected": 7,
  "avgLatencyMs": 89,
  "callsByServer": { "jira": 800, "github": 450 },
  "callsByDecision": { "allow": 1227, "deny": 23 }
}
```

---

## Alerts

### GET /api/alerts

Query alerts.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max alerts to return. |
| `offset` | number | 0 | Pagination offset. |
| `acknowledged` | boolean | | Filter by acknowledged status. |
| `severity` | string | | Filter: `critical`, `high`, `medium`, `low`. |
| `type` | string | | Filter: `injection_detected`, `policy_violation`, `tool_drift`, `rate_limit_exceeded`, `auth_failure`, `server_error`. |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "injection_detected",
      "severity": "critical",
      "title": "Prompt injection detected in search_issues",
      "details": { "indicators": [...], "scanDurationMs": 3.2 },
      "serverId": "uuid",
      "toolName": "search_issues",
      "correlationId": "uuid",
      "acknowledged": false,
      "acknowledgedBy": null,
      "acknowledgedAt": null,
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

### POST /api/alerts/:id/acknowledge

Acknowledge a single alert.

**Response:** `{ "success": true }`

### POST /api/alerts/bulk-acknowledge

Acknowledge multiple alerts.

**Body:**
```json
{ "ids": ["uuid-1", "uuid-2", "uuid-3"] }
```

**Response:** `{ "success": true, "acknowledged": 3 }`

---

## Approvals (HITL)

### GET /api/approvals

List pending approval requests.

**Query parameters:**

| Parameter | Type | Default |
|-----------|------|---------|
| `limit` | number | 50 |
| `offset` | number | 0 |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "correlationId": "uuid",
      "userId": "user_abc",
      "serverName": "banking",
      "toolName": "transfer_funds",
      "params": { "amount": 5000 },
      "status": "pending",
      "requestedAt": "2025-01-15T10:00:00Z",
      "decidedBy": null,
      "decidedAt": null,
      "expiresAt": "2025-01-15T11:00:00Z"
    }
  ],
  "count": 1
}
```

### POST /api/approvals/:id/approve

Approve a pending request.

**Response:** `{ "approval": { ... } }`

### POST /api/approvals/:id/reject

Reject a pending request.

**Response:** `{ "approval": { ... } }`

---

## Webhooks

### GET /api/webhooks

List webhook configurations.

**Response:**
```json
{
  "webhooks": [
    {
      "id": "uuid",
      "url": "https://example.com/webhook",
      "events": ["injection_detected", "tool_drift"],
      "enabled": true,
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/webhooks

Create a new webhook.

**Body:**
```json
{
  "url": "https://example.com/webhook",
  "secret": "your-hmac-secret",
  "events": ["injection_detected", "tool_drift", "server_error"],
  "enabled": true
}
```

**Response:** `201 Created` with `{ "webhook": { ... } }`

### PUT /api/webhooks/:id

Update a webhook.

**Response:** `{ "webhook": { ... } }`

### DELETE /api/webhooks/:id

Delete a webhook.

**Response:** `{ "success": true }`

### POST /api/webhooks/:id/test

Send a test event to the webhook endpoint.

**Response:** `{ "success": true }`

**Webhook payload format:**
```json
{
  "event": "injection_detected",
  "timestamp": "2025-01-15T10:00:00Z",
  "data": { ... }
}
```

**Signature:** The `X-Webhook-Signature` header contains an HMAC-SHA256 hex digest of the JSON body, computed with the webhook's secret.

---

## API Keys

### GET /api/settings/api-keys

List API keys for the tenant. Does not expose the raw key or hash.

**Response:**
```json
{
  "keys": [
    {
      "id": "uuid",
      "name": "CI Pipeline",
      "keyPrefix": "mgw_a1b2",
      "createdBy": "user_abc",
      "lastUsedAt": "2025-01-15T10:00:00Z",
      "expiresAt": "2025-12-31T23:59:59Z",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/settings/api-keys

Create a new API key. **Requires `owner` or `admin` role.**

**Body:**
```json
{
  "name": "CI Pipeline",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Response:** `201 Created`
```json
{
  "key": "mgw_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
  "record": {
    "id": "uuid",
    "name": "CI Pipeline",
    "keyPrefix": "mgw_a1b2",
    "expiresAt": "2025-12-31T23:59:59Z"
  }
}
```

The `key` field is the raw API key. **It is shown only once and cannot be retrieved again.** Store it securely.

### DELETE /api/settings/api-keys/:id

Delete an API key. **Requires `owner` or `admin` role.**

**Response:** `{ "success": true }`

---

## Team Management

### GET /api/settings/team

List team members.

**Response:**
```json
{
  "members": [
    {
      "id": "uuid",
      "clerkUserId": "user_abc",
      "role": "owner",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/settings/team/invite

Invite a team member. **Requires `owner` or `admin` role.**

**Body:**
```json
{
  "clerkUserId": "user_xyz",
  "role": "member"
}
```

**Response:** `201 Created` with `{ "member": { ... } }`

### PUT /api/settings/team/:userId/role

Update a member's role. **Requires `owner` role.**

**Body:**
```json
{ "role": "admin" }
```

**Response:** `{ "member": { ... } }`

### DELETE /api/settings/team/:userId

Remove a team member. **Requires `owner` role.**

**Response:** `{ "success": true }`
