-- ============================================================================
-- MCP Security Gateway — Initial Schema
-- ============================================================================

-- Multi-tenant core
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  default_policy_action TEXT NOT NULL DEFAULT 'allow',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users via Clerk (external auth, store mapping)
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, clerk_user_id)
);

CREATE INDEX idx_tenant_users_clerk ON tenant_users(clerk_user_id);

-- Registered MCP servers
CREATE TABLE mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport IN ('stdio', 'http')),
  command TEXT,
  args JSONB,
  url TEXT,
  env JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_mcp_servers_tenant ON mcp_servers(tenant_id);

-- Tool snapshots for rug pull detection
CREATE TABLE tool_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  definition_hash TEXT NOT NULL,
  definition JSONB NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, server_id, tool_name)
);

CREATE INDEX idx_tool_snapshots_server ON tool_snapshots(server_id);

-- Policy rules
CREATE TABLE policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  priority INT NOT NULL DEFAULT 1000,
  conditions JSONB NOT NULL DEFAULT '{}',
  action TEXT NOT NULL CHECK (action IN ('allow', 'deny', 'require_approval', 'log_only')),
  modifiers JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policy_rules_tenant ON policy_rules(tenant_id);
CREATE INDEX idx_policy_rules_priority ON policy_rules(tenant_id, priority);

-- Audit log (append-only, partitioned by month)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id TEXT,
  server_id UUID NOT NULL,
  server_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  policy_decision TEXT NOT NULL,
  policy_rule_id UUID,
  threats_detected INT NOT NULL DEFAULT 0,
  threat_details JSONB,
  drift_detected BOOLEAN NOT NULL DEFAULT false,
  latency_ms NUMERIC NOT NULL DEFAULT 0,
  request_pii_detected BOOLEAN NOT NULL DEFAULT false,
  response_pii_detected BOOLEAN NOT NULL DEFAULT false,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_correlation ON audit_logs(correlation_id);
CREATE INDEX idx_audit_logs_server ON audit_logs(tenant_id, server_id);
CREATE INDEX idx_audit_logs_tool ON audit_logs(tenant_id, tool_name);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  server_id UUID REFERENCES mcp_servers(id) ON DELETE SET NULL,
  tool_name TEXT,
  correlation_id UUID,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_tenant ON alerts(tenant_id, created_at DESC);
CREATE INDEX idx_alerts_unacked ON alerts(tenant_id, acknowledged) WHERE NOT acknowledged;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for dashboard access (via Supabase anon key + Clerk JWT)
-- The gateway uses service_role key which bypasses RLS

CREATE POLICY "tenant_isolation_tenants" ON tenants
  FOR ALL USING (
    id IN (
      SELECT tenant_id FROM tenant_users
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

CREATE POLICY "tenant_isolation_tenant_users" ON tenant_users
  FOR ALL USING (
    clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
  );

CREATE POLICY "tenant_isolation_mcp_servers" ON mcp_servers
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

CREATE POLICY "tenant_isolation_tool_snapshots" ON tool_snapshots
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

CREATE POLICY "tenant_isolation_policy_rules" ON policy_rules
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

CREATE POLICY "tenant_isolation_audit_logs" ON audit_logs
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );

CREATE POLICY "tenant_isolation_alerts" ON alerts
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );
