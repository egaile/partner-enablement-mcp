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
| `owner` | Full access. Can manage team members, delete members, change roles, create API keys, and manage all resources. |
| `admin` | Can manage API keys, invite team members, and manage all resources except deleting team members or changing roles. |
| `member` | Read access to all data. Can acknowledge alerts and approve/reject HITL requests. |

Role enforcement happens at two levels:
1. **REST API middleware**: The `requireRole()` middleware checks `req.tenant.userRole` against the allowed roles for sensitive endpoints.
2. **Database RLS**: Row-level security policies filter data based on the Clerk user's tenant memberships.

## Auto-provisioning

When a Clerk user authenticates for the first time and has no `tenant_users` entry, the gateway automatically provisions them:

1. Creates a `tenant_users` record mapping them to the default tenant (`00000000-0000-0000-0000-000000000001`)
2. Assigns the `owner` role

This ensures that the first user can immediately start using the gateway without manual database setup.

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

Use the key via the `X-API-Key` header:

```bash
curl http://localhost:4000/api/servers \
  -H "X-API-Key: mgw_a1b2c3d4e5f6..."
```
