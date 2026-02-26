# Policy Rules Reference

Policies control what tool calls are allowed, denied, rate-limited, or require human approval. The gateway evaluates policies in priority order (lower number = higher priority) and applies the first matching rule. If no rules match, the default action is **allow**.

## Policy structure

```json
{
  "name": "Human-readable name",
  "description": "Optional description",
  "priority": 100,
  "conditions": {
    "servers": ["pattern1", "pattern2"],
    "tools": ["pattern1", "pattern2"],
    "users": ["user_id_1", "user_id_2"],
    "timeWindows": [
      {
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startHour": 9,
        "endHour": 17
      }
    ]
  },
  "action": "allow | deny | require_approval | log_only",
  "modifiers": {
    "redactPII": true,
    "maxCallsPerMinute": 10,
    "requireMFA": true
  },
  "enabled": true
}
```

## Fields

### `name` (required)
Human-readable policy name. 1-200 characters.

### `priority` (default: 1000)
Integer 0-10000. Lower values are evaluated first. When multiple rules could match, the lowest-priority rule wins.

### `conditions`
Determines when the rule applies. All specified conditions must match (AND logic). Within each condition array, any single entry matching is sufficient (OR logic).

#### `conditions.servers`
Array of glob patterns matched against the server name using [picomatch](https://github.com/micromatch/picomatch). An empty array or omitted field matches all servers.

Supported patterns:
- `"jira"` -- exact match
- `"*"` -- match everything
- `"prod-*"` -- prefix match
- `"*-internal"` -- suffix match
- `"{jira,github}"` -- match either
- `"!staging-*"` -- negation (match everything except)

#### `conditions.tools`
Array of glob patterns matched against the tool name (without the server namespace prefix).

#### `conditions.users`
Array of exact Clerk user IDs. The rule only applies to these users.

#### `conditions.timeWindows`
Array of time window objects. The rule only applies when the current time falls within at least one window.

- `daysOfWeek`: Array of day numbers (0 = Sunday, 6 = Saturday)
- `startHour`: Start hour (0-23, inclusive)
- `endHour`: End hour (0-23, exclusive)

### `action`
What to do when this rule matches:

| Action | Behavior |
|--------|----------|
| `allow` | Let the call through (with optional modifiers). |
| `deny` | Block the call. Returns an error to the agent. Fires a `policy_violation` alert. |
| `require_approval` | Pause the call and create an approval request. An admin must approve or reject via the dashboard or API. |
| `log_only` | Allow the call but ensure it is prominently logged. Useful for monitoring before enforcing. |

### `modifiers`
Optional behavioral modifiers applied when the action is `allow` or `log_only`:

| Modifier | Type | Description |
|----------|------|-------------|
| `redactPII` | boolean | Scan response text for PII (SSN, credit card, email, phone, IP, DOB, MRN) and replace with `[REDACTED]`. |
| `maxCallsPerMinute` | number | Per-user rate limit using a 60-second sliding window. Exceeding fires a `rate_limit_exceeded` alert and blocks the call. |
| `requireMFA` | boolean | Reserved for future use. |

## Creating a policy via the API

```bash
curl -X POST http://localhost:4000/api/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "My policy",
    "priority": 100,
    "conditions": { "tools": ["delete_*"] },
    "action": "deny"
  }'
```

## Examples

### 1. Block all delete operations

```json
{
  "name": "Block deletes",
  "priority": 100,
  "conditions": { "tools": ["delete_*", "remove_*", "destroy_*"] },
  "action": "deny"
}
```

### 2. Block a specific server entirely

```json
{
  "name": "Block staging server",
  "priority": 50,
  "conditions": { "servers": ["staging-*"] },
  "action": "deny"
}
```

### 3. Require approval for write operations

```json
{
  "name": "Approval for writes",
  "priority": 200,
  "conditions": { "tools": ["create_*", "update_*", "write_*"] },
  "action": "require_approval"
}
```

### 4. Rate limit a specific tool

```json
{
  "name": "Rate limit search",
  "priority": 300,
  "conditions": { "tools": ["search_*"] },
  "action": "allow",
  "modifiers": { "maxCallsPerMinute": 20 }
}
```

### 5. Redact PII in all responses

```json
{
  "name": "Redact PII globally",
  "priority": 500,
  "conditions": {},
  "action": "allow",
  "modifiers": { "redactPII": true }
}
```

### 6. Business hours only

```json
{
  "name": "Business hours only",
  "priority": 150,
  "conditions": {
    "timeWindows": [{
      "daysOfWeek": [1, 2, 3, 4, 5],
      "startHour": 9,
      "endHour": 17
    }]
  },
  "action": "allow"
}
```

Combined with a lower-priority catch-all deny:

```json
{
  "name": "Deny outside business hours",
  "priority": 9000,
  "conditions": {},
  "action": "deny"
}
```

### 7. Restrict specific users

```json
{
  "name": "Intern restrictions",
  "priority": 100,
  "conditions": {
    "users": ["user_2abc123", "user_3def456"],
    "tools": ["*"]
  },
  "action": "deny"
}
```

### 8. Allow specific users to bypass restrictions

```json
{
  "name": "Admin bypass",
  "priority": 10,
  "conditions": {
    "users": ["user_admin_001"]
  },
  "action": "allow"
}
```

### 9. Server + tool combination

```json
{
  "name": "Block Jira delete",
  "priority": 100,
  "conditions": {
    "servers": ["jira"],
    "tools": ["delete_issue", "delete_project"]
  },
  "action": "deny"
}
```

### 10. Rate limit per server

```json
{
  "name": "Rate limit GitHub",
  "priority": 300,
  "conditions": { "servers": ["github"] },
  "action": "allow",
  "modifiers": { "maxCallsPerMinute": 30 }
}
```

### 11. Audit-only mode for new servers

```json
{
  "name": "Log only for new-service",
  "priority": 200,
  "conditions": { "servers": ["new-service"] },
  "action": "log_only"
}
```

### 12. Weekend lockdown

```json
{
  "name": "Weekend deny",
  "priority": 50,
  "conditions": {
    "timeWindows": [{ "daysOfWeek": [0, 6] }]
  },
  "action": "deny"
}
```

### 13. Redact PII for healthcare tools only

```json
{
  "name": "Healthcare PII redaction",
  "priority": 200,
  "conditions": {
    "servers": ["health-*", "medical-*"],
    "tools": ["get_patient_*", "search_records"]
  },
  "action": "allow",
  "modifiers": { "redactPII": true }
}
```

### 14. Approval for financial operations with rate limit

```json
{
  "name": "Financial approval + rate limit",
  "priority": 100,
  "conditions": {
    "servers": ["banking"],
    "tools": ["transfer_*", "payment_*"]
  },
  "action": "require_approval"
}
```

### 15. Negation pattern -- allow everything except one server

```json
{
  "name": "Block internal-only server",
  "priority": 100,
  "conditions": { "servers": ["internal-*"] },
  "action": "deny"
}
```

### 16. Strict mode -- deny by default, allowlist specific tools

Create a high-priority allow rule for approved tools:

```json
{
  "name": "Allowlisted tools",
  "priority": 100,
  "conditions": {
    "tools": ["search_issues", "get_issue", "list_projects"]
  },
  "action": "allow"
}
```

Then a catch-all deny:

```json
{
  "name": "Deny everything else",
  "priority": 9999,
  "conditions": {},
  "action": "deny"
}
```

## Policy evaluation order

1. Fetch all enabled policies for the tenant (cached for 30 seconds by default).
2. Sort by `priority` ascending.
3. For each rule, check all conditions. If all conditions match, return the rule's action and modifiers.
4. If no rule matches, return `allow` (the default).

## Policy simulator

Test how a policy would evaluate without making a real tool call:

```bash
curl -X POST http://localhost:4000/api/policies/simulate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "serverName": "jira",
    "toolName": "delete_issue",
    "userId": "user_abc123",
    "params": { "issueKey": "PROJ-42" }
  }'
```

Response:

```json
{
  "decision": "deny",
  "matchedRule": {
    "ruleId": "...",
    "ruleName": "Block Jira delete",
    "action": "deny"
  },
  "modifiers": {},
  "scanResult": { "clean": true, "threatCount": 0, "highestSeverity": null },
  "wouldBeBlocked": true,
  "reason": "Blocked by policy \"Block Jira delete\""
}
```

The simulator also runs the injection scanner on the provided params so you can see if the request would be blocked by threat detection independently of policies.

## Policy cache

Policies are cached in memory with a 30-second TTL (configurable via `POLICY_CACHE_TTL_MS`). After creating or updating a policy, it may take up to 30 seconds for the change to take effect on active sessions.
