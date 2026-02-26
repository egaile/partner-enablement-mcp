# Dashboard Walkthrough

The admin dashboard is a Next.js 14 application that provides a visual interface for managing the MCP Security Gateway. It uses Clerk for authentication and communicates with the gateway's REST API.

## Accessing the dashboard

The dashboard runs on port 3001 locally:

```bash
cd dashboard
npm run dev
# Open http://localhost:3001
```

You will be redirected to Clerk's sign-in page. After authenticating, you land on the main dashboard.

## Pages

### Dashboard (Home)

The home page provides an at-a-glance view of gateway activity:

- **Metric cards** showing key statistics from the last 24 hours:
  - Total tool calls
  - Blocked requests
  - Threats detected
  - Active alerts
- **Recent activity** feed showing the latest audit log entries with status indicators (allowed, denied, threat detected)

The data is fetched from `GET /api/audit/metrics` and `GET /api/audit?limit=10`.

### Servers

The servers page lists all registered downstream MCP servers with their connection status.

**Server list view:**
- Each server shows its name, transport type (HTTP or stdio), enabled/disabled status, and creation date
- Click a server card to view details

**Server detail view:**
- Server configuration (URL, command, args, env)
- **Tool inventory**: lists all tools discovered from that server with their names, descriptions, and input schemas
- **Health status**: current health (healthy/degraded/unreachable), latency, consecutive failures
- **Tool snapshots**: history of tool definition changes with approve/reject actions for drift

**Adding a server:**
- Click "Add Server" to open a form
- Choose transport type (HTTP or stdio)
- Fill in the required fields (URL for HTTP, command for stdio)
- The gateway will automatically connect and discover tools

### Policies

The policies page manages the policy rules that control tool access.

**Policy list:**
- Shows all policies sorted by priority
- Each entry displays name, priority, action (color-coded), and conditions summary
- Toggle switch to enable/disable policies without deleting them

**Rule builder:**
- Create new policies with a visual form
- Server and tool conditions with glob pattern input
- User condition with multi-select
- Time window configuration with day-of-week checkboxes and hour selectors
- Action selector (allow, deny, require_approval, log_only)
- Modifier toggles for PII redaction and rate limiting

### Audit Log

A paginated table of all tool calls processed by the gateway.

**Columns:**
- Timestamp
- Server name
- Tool name
- Policy decision (allow/deny)
- Threats detected count
- Drift detected flag
- PII detected (request/response)
- Latency (ms)
- Success/error status
- Correlation ID (for cross-referencing with alerts)

**Filters:**
- Server ID
- Tool name
- Date range (start/end)
- Pagination controls (limit/offset)

### Alerts

The alerts page shows security events that require attention.

**Alert types:**
- `injection_detected` -- prompt injection attempt blocked
- `tool_drift` -- tool definition changed unexpectedly
- `policy_violation` -- request denied by policy rule
- `rate_limit_exceeded` -- user exceeded rate limit
- `auth_failure` -- authentication failure
- `server_error` -- downstream server connection or health check failure

**Alert feed:**
- Sorted by creation time (newest first)
- Severity badges (critical, high, medium, low)
- Expandable details for each alert
- Individual acknowledge button
- Bulk acknowledge for clearing multiple alerts

**Filters:**
- Acknowledged/unacknowledged toggle
- Severity filter
- Alert type filter

### Approvals

The approvals page manages human-in-the-loop (HITL) approval requests.

When a policy with `action: "require_approval"` matches a tool call, the gateway creates a pending approval request. The call is held until an administrator approves or rejects it, or until it expires (1 hour default).

**Approval list:**
- Shows pending requests with requester, server, tool, and parameters
- Approve and reject buttons for each request
- Expired requests are automatically marked

### Settings

The settings page contains tenant-level configuration.

**API Keys:**
- Generate new API keys for programmatic access (format: `mgw_<32 hex chars>`)
- The raw key is shown only once at creation time
- List existing keys showing prefix, name, creator, last used, and expiry
- Delete keys (requires owner or admin role)

**Team Management:**
- List team members with their roles
- Invite new members by Clerk user ID
- Roles: `owner`, `admin`, `member`
  - `owner`: full access including team management and deleting members
  - `admin`: can manage API keys and invite members
  - `member`: read access to all data, can acknowledge alerts and approve requests
- Remove members (owner only)
- Update member roles (owner only)

**Webhooks:**
- Configure webhook endpoints for alert notifications
- Subscribe to specific event types
- HMAC-SHA256 signed payloads for verification
- Test button to send a test event
- Enable/disable without deleting

## Layout

The dashboard uses a sidebar navigation on the left with page links:
- Dashboard (home)
- Servers
- Policies
- Audit Log
- Alerts
- Approvals
- Settings

A top bar shows the current page title and the authenticated user's profile via Clerk's `<UserButton>` component.
