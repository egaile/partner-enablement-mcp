# Tool Drift Detection

Tool drift detection protects against "rug pull" attacks where a downstream MCP server silently changes its tool definitions after initial registration. This can introduce new attack surfaces, break expected behavior, or alter the security posture of the tool.

## How it works

### Initial snapshot

When a tool is called for the first time, the gateway:

1. Creates a canonical JSON representation of the tool definition:
   ```json
   {
     "name": "tool_name",
     "description": "Tool description",
     "inputSchema": { ... }
   }
   ```
2. Computes a SHA-256 hash of this JSON string.
3. Stores both the hash and the full definition in the `tool_snapshots` table.
4. Marks it as `approved = true`.

This initial snapshot becomes the baseline for all future comparisons.

### Drift checking

On every subsequent tool call, the gateway:

1. Hashes the current tool definition (as reported by the downstream server's `tools/list`).
2. Looks up the stored snapshot for that tenant + server + tool combination.
3. Compares the hashes.

If the hashes match, the tool has not changed and the call proceeds normally.

If the hashes differ, the gateway performs a detailed comparison to classify the change.

### Change classification

The gateway inspects what specifically changed and assigns a severity level:

| Change | Severity | Effect |
|--------|----------|--------|
| New parameters added to input schema | `critical` | **Blocks the call.** New parameters could be used for injection attacks. |
| Parameters removed from input schema | `functional` | Alerts but does not block. May break expected behavior. |
| Input schema added (was empty) | `functional` | Alerts but does not block. |
| Input schema removed (was present) | `functional` | Alerts but does not block. |
| Description changed | `cosmetic` | Alerts at lower severity. |

### Blocking behavior

Only `critical` severity drift blocks the tool call. The response to the agent is:

```
Request blocked: tool "tool_name" definition has changed unexpectedly. An administrator has been notified.
```

All drift (including non-blocking) fires a `tool_drift` alert with the appropriate severity.

## Database schema

```sql
CREATE TABLE tool_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  server_id UUID NOT NULL REFERENCES mcp_servers(id),
  tool_name TEXT NOT NULL,
  definition_hash TEXT NOT NULL,
  definition JSONB NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, server_id, tool_name)
);
```

Key fields:
- `definition_hash`: The SHA-256 hash of the canonical tool definition.
- `definition`: The full JSONB definition for human review.
- `approved`: Whether this snapshot has been reviewed and approved by an administrator.

## Reviewing and approving drift

When drift is detected, an alert appears in the dashboard. Administrators can review the changes and either approve the new definition or take corrective action.

### View snapshots for a server

```bash
GET /api/servers/<server-id>/snapshots
Authorization: Bearer <token>
```

Response:

```json
{
  "snapshots": [
    {
      "id": "snapshot-uuid",
      "toolName": "search_issues",
      "definitionHash": "abc123...",
      "definition": {
        "name": "search_issues",
        "description": "Search for issues",
        "inputSchema": { ... }
      },
      "approved": true,
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### Approve a new definition

To approve the current (drifted) definition, POST the new hash and definition:

```bash
POST /api/servers/<server-id>/snapshots/<snapshot-id>/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "newHash": "def456...",
  "newDefinition": {
    "name": "search_issues",
    "description": "Updated search",
    "inputSchema": { ... }
  }
}
```

This updates the snapshot with the new hash and definition, and marks it as approved. Subsequent calls will compare against this new baseline.

To simply approve the existing snapshot (e.g., re-approve after review):

```bash
POST /api/servers/<server-id>/snapshots/<snapshot-id>/approve
Authorization: Bearer <token>
```

## Alert details

Drift alerts include:

```json
{
  "type": "tool_drift",
  "severity": "critical",
  "title": "Tool definition drift: search_issues",
  "details": {
    "changes": ["parameter added: newParam"],
    "currentHash": "def456...",
    "approvedHash": "abc123..."
  },
  "serverId": "server-uuid",
  "toolName": "search_issues"
}
```

The `changes` array describes exactly what changed, and the hash values allow manual verification.

## Examples

### Benign drift: description update

A server operator fixes a typo in a tool description.

- **Change detected**: "description changed"
- **Severity**: `cosmetic`
- **Behavior**: Alert fired, call proceeds normally
- **Action**: Review and approve the new snapshot at your convenience

### Suspicious drift: new parameter added

A tool that previously accepted `{ query: string }` now accepts `{ query: string, webhookUrl: string }`.

- **Change detected**: "parameter added: webhookUrl"
- **Severity**: `critical`
- **Behavior**: Call blocked, alert fired
- **Action**: Investigate why the parameter was added. If legitimate, approve the new snapshot. If suspicious, disable the server.

### Breaking drift: parameter removed

A tool that previously accepted `{ projectKey: string, issueType: string }` now only accepts `{ projectKey: string }`.

- **Change detected**: "parameter removed: issueType"
- **Severity**: `functional`
- **Behavior**: Alert fired, call proceeds (may fail downstream due to missing parameter)
- **Action**: Update any agents that rely on the removed parameter. Approve the new snapshot.

## Hash computation

The canonical form for hashing ensures consistent results regardless of property ordering:

```typescript
function hashToolDefinition(def: ToolDefinition): string {
  const canonical = JSON.stringify({
    name: def.name,
    description: def.description ?? "",
    inputSchema: def.inputSchema ?? {},
  });
  return createHash("sha256").update(canonical).digest("hex");
}
```

Note: `JSON.stringify` produces deterministic output for the same object structure in Node.js. The fields are always ordered as `name`, `description`, `inputSchema`.
