# Incident Response

When the gateway detects a security event, it fires an alert and logs the event. This guide covers what to do when each type of alert fires.

## Alert types

| Type | Severity | Meaning |
|------|----------|---------|
| `injection_detected` | Critical/High | A tool call contained a prompt injection attempt. |
| `tool_drift` | Critical/High/Medium | A downstream server changed its tool definitions. |
| `policy_violation` | Medium | A tool call was denied by a policy rule. |
| `rate_limit_exceeded` | Medium | A user exceeded the configured calls-per-minute limit. |
| `auth_failure` | High | An authentication attempt failed. |
| `server_error` | High | A downstream server failed to respond or connect. |

## Responding to injection alerts

**Severity: Critical or High**

An injection attempt was detected and blocked. The tool call did not reach the downstream server.

### Immediate actions

1. **Review the alert details.** The `details.indicators` array shows exactly what was detected, including the strategy, severity, description, and the field path where the threat was found.

2. **Look up the correlation ID.** Use it to find the audit log entry:
   ```bash
   GET /api/audit?correlationId=<correlation-id>
   ```

3. **Identify the source.** Check the `userId` field to see which user (or AI agent session) triggered the alert.

4. **Assess the threat.** Is this a real attack or a false positive?
   - **Real attack**: The content clearly attempts to override instructions, inject delimiters, or exfiltrate data.
   - **False positive**: Legitimate content that happened to match a pattern (e.g., a user discussing prompt injection in a support ticket).

### Follow-up

- **If real**: Consider blocking the user via a deny policy, rotating any credentials the user had access to, and investigating whether prior (non-blocked) calls from the same user were malicious.
- **If false positive**: Acknowledge the alert. Consider whether the scanner patterns need tuning for your use case. The scanner errs on the side of caution.

## Responding to drift alerts

**Severity: Critical, High, or Medium**

A downstream server's tool definition changed since the last approved snapshot.

### Immediate actions

1. **Review the changes.** The alert `details.changes` array lists what changed (e.g., "parameter added: webhookUrl", "description changed").

2. **Check the severity.**
   - `critical` (new parameters added): The call was blocked. New parameters could be used for injection.
   - `functional` (parameters removed/schema changed): The call proceeded but behavior may be affected.
   - `cosmetic` (description changed): The call proceeded normally.

3. **Investigate the cause.** Contact the downstream server operator. Was this an intentional update?

### Follow-up

- **If the change is legitimate**: Approve the new snapshot:
  ```bash
  POST /api/servers/<server-id>/snapshots/<snapshot-id>/approve
  ```
  Include `newHash` and `newDefinition` in the body if the snapshot needs updating.

- **If the change is suspicious**: Disable the server immediately:
  ```bash
  PUT /api/servers/<server-id> -d '{"enabled": false}'
  ```
  Investigate the downstream server for compromise.

## Responding to policy violations

**Severity: Medium**

A tool call was denied by a policy rule. This is usually informational -- the policy is working as intended.

### When to investigate

- **High volume of violations from one user**: May indicate an AI agent stuck in a loop trying to use a blocked tool.
- **Violations on unexpected tools**: May indicate misconfigured policies or an agent using tools outside its intended scope.

### Actions

1. Review the matched rule name and action in the alert.
2. If the policy is correct, acknowledge the alert.
3. If the policy is too restrictive, update it via `PUT /api/policies/<id>`.
4. If a specific user needs access, create a higher-priority allow rule for that user.

## Responding to rate limit alerts

**Severity: Medium**

A user exceeded the configured calls-per-minute limit for a specific tool.

### When to investigate

- **Agent in a loop**: An AI agent may be retrying a failed call repeatedly. Check the audit log for the same tool being called many times in succession.
- **Legitimate high usage**: The rate limit may be too low for the intended use case.

### Actions

1. Check if the calling agent has a bug (infinite loop, retry without backoff).
2. If the rate limit is appropriate, acknowledge the alert.
3. If the limit needs adjustment, update the policy:
   ```bash
   PUT /api/policies/<id> -d '{"modifiers": {"maxCallsPerMinute": 50}}'
   ```

## Responding to auth failures

**Severity: High**

An authentication attempt failed. This could be an expired token, invalid API key, or unauthorized access attempt.

### When to investigate

- **Repeated failures from the same source**: May indicate a brute-force attempt or a misconfigured client.
- **Failures with valid-looking tokens**: May indicate a Clerk configuration issue.

### Actions

1. Check if the failure is from a known client with an expired token (common during development).
2. If the failure pattern looks like an attack, consider rate limiting at the network level.
3. If using API keys, verify the key hasn't expired.

## Responding to server errors

**Severity: High**

A downstream MCP server failed to respond.

### Error types

- `connection_failure`: The gateway could not connect to the server at all.
- `tool_call_failure`: The server connected but the tool call failed.
- `health_check_failure`: The server failed 3 consecutive health checks and is marked as unreachable.

### Actions

1. **Check server health**: `GET /api/servers/<id>/health`
2. **Verify the server is running**: Test the server's endpoint directly.
3. **Check network**: Ensure the gateway can reach the server (firewall, DNS, SSL).
4. **Review server logs**: Look at the downstream server's logs for errors.
5. **Restart if needed**: Disable and re-enable the server to force a reconnection.

## Acknowledging alerts

After investigating, acknowledge alerts to clear them from the active feed:

**Single alert:**
```bash
POST /api/alerts/<id>/acknowledge
```

**Bulk acknowledge:**
```bash
POST /api/alerts/bulk-acknowledge
Content-Type: application/json

{ "ids": ["alert-id-1", "alert-id-2", "alert-id-3"] }
```

Acknowledged alerts are not deleted. They remain in the database with `acknowledged = true` and can be filtered in the audit view.

## Webhook notifications

Configure webhooks to receive real-time alert notifications:

```bash
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhook/gateway-alerts",
  "secret": "your-hmac-secret",
  "events": ["injection_detected", "tool_drift", "server_error"],
  "enabled": true
}
```

Webhook payloads are signed with HMAC-SHA256. Verify the `X-Webhook-Signature` header:

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', secret)
  .update(requestBody)
  .digest('hex');
const valid = signature === req.headers['x-webhook-signature'];
```

## Correlation IDs

Every tool call is assigned a UUID correlation ID that links:
- The audit log entry
- Any alerts fired during that call
- Any approval requests created

Use the correlation ID to trace the complete history of a single tool call across all subsystems.

```bash
# Find the audit entry
GET /api/audit?correlationId=<correlation-id>

# Find related alerts
GET /api/alerts?correlationId=<correlation-id>
```
