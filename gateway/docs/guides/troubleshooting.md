# Troubleshooting

## Gateway won't start

### "Invalid gateway configuration"

The gateway validates all required environment variables at startup using Zod. The error message lists which fields are missing or invalid.

```
Invalid gateway configuration:
  supabaseUrl: Required
  supabaseServiceRoleKey: Required
  clerkSecretKey: Required
```

**Fix:** Ensure your `.env` file contains `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CLERK_SECRET_KEY`. For local development, set `CLERK_SECRET_KEY=dev`.

### Port already in use

```
Error: listen EADDRINUSE :::4000
```

**Fix:** Another process is using port 4000. Either stop it or set a different port: `PORT=4001 npm run dev`.

## Authentication errors

### "Missing or invalid Authorization header"

The gateway expects either:
- A `Bearer <token>` header with a valid Clerk JWT, or
- An `X-API-Key` header with a valid gateway API key

**Fix in dev mode:** Set `CLERK_SECRET_KEY=dev` in your `.env`. This skips Clerk verification entirely.

**Fix in production:** Ensure your Clerk token is valid and not expired. Tokens from Clerk have a short TTL (typically 60 seconds) and must be refreshed.

### "User is not associated with any tenant"

The authenticated user exists in Clerk but has no entry in the `tenant_users` table.

**Fix:** The gateway auto-provisions new users to the default tenant (`00000000-0000-0000-0000-000000000001`). Ensure the default tenant exists:

```sql
SELECT * FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001';
```

If it doesn't exist, create it (see [Getting Started](./getting-started.md)).

## Server connection failures

### "Failed to connect to <server>"

This means the gateway could not establish an MCP connection to a downstream server.

**For HTTP servers:**
- Verify the URL is correct and the server is running
- Check network connectivity from the gateway to the server
- Ensure the server responds to MCP's `initialize` handshake

**For stdio servers:**
- Verify the command exists and is on PATH
- Check that `npx` can resolve the package (run the command manually)
- Review args and env variables for correctness

### Tools not appearing

If you registered a server but its tools don't appear in `tools/list`:

1. Check server health: `GET /api/servers/<id>/health`
2. Check gateway logs for connection errors
3. Restart the gateway -- engine instances are cached per tenant and may not pick up new servers until restarted

### "Bad request: no valid session"

This occurs when sending a GET or non-POST request to `/mcp` without a valid `mcp-session-id` header.

**Fix:** Always start with a POST request to get a session, then include the `mcp-session-id` header in subsequent requests.

## Policy issues

### Policy not taking effect

Policies are cached for 30 seconds (configurable via `POLICY_CACHE_TTL_MS`). After creating or updating a policy, wait up to 30 seconds or restart the gateway.

**To verify a policy would match:**

```bash
curl -X POST http://localhost:4000/api/policies/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "my-server",
    "toolName": "my-tool"
  }'
```

### Wrong policy matching

Policies are evaluated in priority order (lowest number first). A higher-priority rule may be matching before your intended rule.

**Debug steps:**
1. List all policies: `GET /api/policies`
2. Sort by priority and review conditions
3. Use the simulator to see which rule matches
4. Adjust priorities so the correct rule takes precedence

### Time window not working as expected

Time windows use the gateway server's local time, not the client's timezone. Days are numbered 0 (Sunday) through 6 (Saturday). `startHour` is inclusive, `endHour` is exclusive.

Example: `"startHour": 9, "endHour": 17` means 9:00 through 16:59.

## Threat detection

### False positives

The injection scanner is intentionally aggressive. Some legitimate content may trigger alerts:

- **URLs in parameters** -- the exfiltration strategy flags URLs at medium severity. These are logged but do not block requests (only critical and high severity triggers blocking).
- **Email addresses** -- flagged at low severity by the exfiltration strategy. Not blocking.
- **HTML/XML content** -- the structural strategy flags tags like `<script>`, `<system>`, and `<tool_result>`. If your downstream servers legitimately handle HTML, consider wrapping content differently.

Threat severity levels and their effects:
- `critical` / `high` -- request is blocked
- `medium` / `low` / `info` -- logged but request proceeds

### PII detection false positives

The PII scanner uses regex patterns for SSN, credit cards (with Luhn validation), email, phone, IP addresses, dates of birth, and medical record numbers. False positives can occur with:
- Number sequences that happen to match SSN format
- Phone number patterns in non-PII context

PII detection only triggers redaction when a policy has `"redactPII": true`. Without that modifier, PII is detected and logged but not redacted.

## Audit log

### Audit entries missing

The audit logger uses buffered writes for performance. Entries are flushed to Supabase either:
- Every 5 seconds (configurable via `AUDIT_FLUSH_INTERVAL_MS`)
- When the buffer reaches 50 entries (configurable via `AUDIT_BATCH_SIZE`)
- On graceful shutdown (SIGTERM/SIGINT)

If the gateway crashes without a graceful shutdown, buffered entries may be lost.

### Audit entries have wrong tenant

Ensure your Clerk user is associated with the correct tenant in `tenant_users`. In dev mode, all requests map to `dev_user`.

## Dashboard issues

### Dashboard can't reach the gateway

Check CORS configuration. The gateway allows:
- `http://localhost:3001` (always, for local dev)
- Origins matching `*.vercel.app`
- Any origin listed in `ALLOWED_ORIGINS`

Set `ALLOWED_ORIGINS` to include your dashboard URL:

```bash
ALLOWED_ORIGINS=https://your-dashboard.vercel.app,http://localhost:3001
```

### Clerk authentication fails in dashboard

Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set correctly in the dashboard's environment. The publishable key starts with `pk_test_` or `pk_live_`.

## Performance

### High latency on tool calls

Check the audit log for `latencyMs` values. If latency is high:
- The downstream server may be slow -- check its health endpoint
- The injection scanner adds a few milliseconds per call (typically <10ms)
- Policy evaluation is cached and should be <1ms

### Memory usage growing

The gateway caches per-tenant engine instances, MCP transports, and rate limiter windows in memory. Transports are cleaned up after 30 minutes of inactivity. If memory grows unbounded, check for:
- Many unique tenants with active sessions
- Rate limiter windows not being cleaned up (cleanup runs every 60 seconds)
