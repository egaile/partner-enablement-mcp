-- Sprint 5: HITL Approval Requests
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  correlation_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
);

CREATE INDEX idx_approval_requests_tenant ON approval_requests(tenant_id, status);
CREATE INDEX idx_approval_requests_correlation ON approval_requests(correlation_id);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own approvals" ON approval_requests
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));
