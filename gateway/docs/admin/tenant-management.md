# Tenant Management

The MCP Security Gateway is multi-tenant by design. Each tenant has isolated servers, policies, audit logs, alerts, and team members. Row Level Security (RLS) in Supabase enforces data isolation at the database level.

## Architecture

```
Tenant (organization)
  |-- Tenant Users (people with access)
  |-- MCP Servers (downstream servers)
  |-- Policy Rules
  |-- Audit Logs
  |-- Alerts
  |-- Approval Requests
  |-- Webhooks
  |-- API Keys
```

Every database table includes a `tenant_id` foreign key, and RLS policies ensure that:
- Users can only see data belonging to tenants they are members of
- The gateway service (using the Supabase service role key) bypasses RLS for cross-cutting operations

## Tenants table

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  default_policy_action TEXT NOT NULL DEFAULT 'allow',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- `id`: UUID primary key. The default tenant uses `00000000-0000-0000-0000-000000000001`.
- `name`: Display name for the tenant.
- `slug`: URL-safe unique identifier.
- `default_policy_action`: The fallback action when no policy rule matches (default: `allow`).
- `settings`: JSONB field for tenant-specific configuration.

## User-tenant mapping

```sql
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  clerk_user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, clerk_user_id)
);
```

Users are identified by their Clerk user ID. A user can belong to multiple tenants with different roles.

### Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full access. Can manage team members, delete members, change roles, create API keys, approve or reject requests, and manage all resources. |
| `admin` | Can manage API keys, invite team members, approve or reject requests, and manage all resources except deleting team members or changing roles. |
| `member` | Can manage servers, policies, webhooks and alerts, but can't approve or reject requests. Can't manage API keys or the team. |
| `viewer` | Read-only. Can browse servers, tools, policies, the audit log, alerts and approvals (tool arguments hidden), and run the policy simulator. Can't see API keys, team members or billing history, and can't call `/mcp`. |

Role enforcement happens at two levels:
1. **REST API middleware**: `requireAuth` rejects any request from a `viewer` that isn't an allowed read (see `gateway/src/auth/viewer-access.ts`), and `requireRole()` guards team, API-key, and approve/reject endpoints.
2. **Database RLS**: Row-level security policies filter data based on the Clerk user's tenant memberships.

## Auto-provisioning

When a Clerk user authenticates for the first time and has no `tenant_users` entry, the gateway automatically provisions them:

1. Creates a `tenant_users` record mapping them to the default tenant (`00000000-0000-0000-0000-000000000001`)
2. Assigns the `viewer` role

Anyone can sign up through Clerk, so new users start read-only. There is no role-change control in the dashboard yet (**Settings > Team** only shows each member's role). An owner promotes a user with `PUT /api/settings/team/<clerk-user-id>/role` (owner only, see [Update a member's role](#update-a-members-role)), or by updating `tenant_users` in SQL:

```sql
UPDATE tenant_users
SET role = 'member'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND clerk_user_id = 'user_from_clerk';
```

To bootstrap the first owner, set their role in `tenant_users` directly the same way.

## Public demo login

The dashboard's sign-in page can show a **Try the demo** button that signs visitors in as a shared read-only user, without sharing a password.

1. In the Clerk dashboard, create a user for the demo (for example `demo@yourdomain.com`). It doesn't need a password.
2. Copy its user ID (`user_...`).
3. On the gateway, set `DEMO_CLERK_USER_IDS=<user id>`. The gateway always treats these users as `viewer`, whatever `tenant_users` says.
4. On the dashboard, set `DEMO_CLERK_USER_ID=<user id>` and redeploy. The button appears on `/sign-in`.

Clicking the button calls `/api/demo-login`, which creates a Clerk sign-in token that expires after 2 minutes and redirects to `/demo`, which redeems it. The demo user lands in the default tenant with a read-only banner and an **Exit demo** button. Clerk's account menu is hidden for this user so visitors can't change its email or security settings.

## Team management API

### List team members

```bash
GET /api/settings/team
Authorization: Bearer <token>
```

### Invite a member

```bash
POST /api/settings/team/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "clerkUserId": "user_2abc123",
  "role": "member"
}
```

Requires `owner` or `admin` role.

### Update a member's role

```bash
PUT /api/settings/team/<clerk-user-id>/role
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "admin"
}
```

Requires `owner` role.

### Remove a member

```bash
DELETE /api/settings/team/<clerk-user-id>
Authorization: Bearer <token>
```

Requires `owner` role.

## Creating additional tenants

Currently, tenants are created directly in the database:

```sql
INSERT INTO tenants (name, slug)
VALUES ('Acme Corp', 'acme-corp');
```

Then add users:

```sql
INSERT INTO tenant_users (tenant_id, clerk_user_id, role)
VALUES (
  (SELECT id FROM tenants WHERE slug = 'acme-corp'),
  'user_from_clerk',
  'owner'
);
```

## Data isolation

### RLS policies

Every table with a `tenant_id` column has an RLS policy that restricts access based on the current Clerk user's tenant memberships:

```sql
CREATE POLICY "tenant_isolation_mcp_servers" ON mcp_servers
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );
```

This means:
- Dashboard queries (using the Supabase anon key with Clerk JWT) are automatically scoped to the user's tenants.
- Gateway queries (using the Supabase service role key) bypass RLS and can access all tenants. The gateway adds tenant scoping in its own query logic.

### Cross-tenant isolation

- Servers registered by Tenant A are invisible to Tenant B.
- Policies created by Tenant A do not affect Tenant B.
- Audit logs are scoped per tenant.
- Alerts cannot be seen or acknowledged across tenants.
- API keys are scoped to their creating tenant.

## API key authentication

As an alternative to Clerk Bearer tokens, tenants can create API keys for programmatic access:

```bash
POST /api/settings/api-keys
Authorization: Bearer <token>

{
  "name": "CI Pipeline Key",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

The response includes the raw key (shown once):

```json
{
  "key": "mgw_a1b2c3d4e5f6...",
  "record": {
    "id": "...",
    "name": "CI Pipeline Key",
    "keyPrefix": "mgw_a1b2",
    "expiresAt": "2025-12-31T23:59:59Z"
  }
}
```

API keys are stored as SHA-256 hashes. The raw key cannot be retrieved after creation.

Send the key as a bearer token in the `Authorization` header. The gateway treats any bearer value that starts with `mgw_` as an API key:

```bash
curl http://localhost:4000/api/servers \
  -H "Authorization: Bearer mgw_a1b2c3d4e5f6..."
```

Requests made with an API key run with the `member` role, so they can't approve or reject approval requests.
