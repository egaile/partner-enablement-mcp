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
- Each server shows its name, transport type, enabled/disabled status, and creation date
- Click a server card to view details

**Server detail view:**
- Server configuration (transport, URL, date added). The URL has credentials removed: members see scheme, host and path with any query string shown as `?[redacted]`, and viewers see only scheme and host
- **Tool inventory**: lists all tools discovered from that server with their names, descriptions, and input schemas
- **Health status**: current health (healthy/degraded/unreachable), latency, consecutive failures
- **Tool snapshots**: history of tool definition changes with approve/reject actions for drift

**Adding a server:**
- Click "Add Server" to open a form
- Transport is HTTP only. The hosted gateway doesn't run stdio servers; use the self-hosted `mcpshield` CLI for those
- Fill in the server URL
- For Atlassian Rovo, the form auto-detects the URL and suggests Basic Auth or OAuth
- The gateway will automatically connect and discover tools

**OAuth connections:**
- For servers supporting OAuth 2.1 (like Atlassian Rovo), click "Authorize" to start the OAuth flow
- The gateway handles discovery, PKCE, and token exchange automatically via the MCP SDK
- Check connection status from the server detail page; click "Re-authorize" if tokens need refreshing

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

**Policy simulator:**
- Test policy evaluation without making real tool calls
- Enter a server name, tool name, user ID, and params
- See which rule would match, the resulting action, and injection scan results

**Atlassian templates:**
- Pre-built policy templates for Atlassian Rovo (Read-Only Jira, Protected Projects, Approval for Writes, Confluence View-Only, Audit Everything, PII Shield)
- Apply from the Onboarding wizard or via the API

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
- `injection_detected`: prompt injection attempt blocked
- `tool_drift`: tool definition changed unexpectedly
- `policy_violation`: request denied by policy rule
- `rate_limit_exceeded`: user exceeded rate limit
- `auth_failure`: authentication failure
- `server_error`: downstream server connection or health check failure

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
- Approve and reject buttons for each request, shown only to owners and admins
- Expired requests are automatically marked

### Tools

A browsable catalog of all discovered tools across connected servers.

- Grouped by server
- Shows tool name, description, and input schema
- Indicates which tools are active (server enabled) vs inactive

### Settings

The settings page is organized into 6 tabs. Read-only (`viewer`) users see 4: the Team and API Keys tabs are hidden for them.

**Account:**
- Clerk profile management

**Team:**
- Lists team members with their roles. This is all the dashboard does today: it doesn't have invite, remove or change-role controls.
- Roles: `owner`, `admin`, `member`, `viewer`
  - `owner`: full access including team management and deleting members
  - `admin`: can manage API keys, invite members, and approve or reject requests
  - `member`: can manage servers, policies, webhooks and alerts, but can't approve or reject requests
  - `viewer`: read-only. Can browse pages and run the policy simulator, but every change is refused. This is the default role for new sign-ups and for the demo login.
- Managing members is API-only for now:
  - Invite a member by Clerk user ID: `POST /api/settings/team/invite` with `{ "clerkUserId": "...", "role": "member" }` (owner or admin)
  - Remove a member: `DELETE /api/settings/team/:userId` (owner only)
  - Change a member's role: `PUT /api/settings/team/:userId/role` with `{ "role": "admin" }` (owner only)
- To give a new sign-up edit access, an owner changes their role from `viewer` to `member` or `admin` with the role endpoint.

**API Keys:**
- Generate new API keys for programmatic access (format: `mgw_<32 hex chars>`)
- The raw key is shown only once at creation time
- List existing keys showing prefix, name, creator, last used, and expiry
- Delete keys (requires owner or admin role)

**Billing:**
- View current plan and usage (tool calls, server count)
- Upgrade plan via Stripe Checkout
- Manage billing via Stripe Customer Portal
- View billing history and invoices

**Gateway:**
- Webhook configuration
- Configure webhook endpoints for alert notifications
- Subscribe to specific event types
- HMAC-SHA256 signed payloads for verification
- Test button to send a test event
- Enable/disable without deleting

**General:**
- Gateway configuration display

## Layout

The dashboard uses a responsive sidebar navigation on the left (collapsible on desktop, Sheet overlay on mobile) with page links:
- Dashboard (home)
- Servers
- Policies
- Tools
- Approvals (with pending count badge)
- Audit Log
- Alerts (with unacknowledged count badge)
- Documentation
- Settings

A top bar shows breadcrumb navigation and a notification bell with unacknowledged alert count. The authenticated user's profile is managed via Clerk's `<UserButton>` component.

### Onboarding

New users are guided through a 4-step Atlassian-first onboarding wizard:

1. **Welcome**: overview of the gateway and its capabilities
2. **Connect Atlassian**: add the Rovo MCP Server with API token or OAuth
3. **Choose Template**: select and apply Atlassian policy templates
4. **Get API Key**: generate an API key for programmatic access

The onboarding wizard is accessible from `/onboarding` and is automatically shown for new tenants.
