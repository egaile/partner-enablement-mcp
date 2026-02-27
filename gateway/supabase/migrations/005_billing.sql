-- ============================================================================
-- MCP Security Gateway — Billing & Usage Metering
-- ============================================================================

-- Add billing columns to tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS plan_limits JSONB NOT NULL DEFAULT '{"maxServers": 1, "maxCallsPerMonth": 1000}',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Add constraint for valid plan values
ALTER TABLE tenants
  ADD CONSTRAINT valid_plan CHECK (plan IN ('starter', 'pro', 'business', 'enterprise'));

-- Usage meters — atomic counter per tenant per billing period
CREATE TABLE usage_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  call_count BIGINT NOT NULL DEFAULT 0,
  blocked_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period_start)
);

CREATE INDEX idx_usage_meters_tenant ON usage_meters(tenant_id, period_start DESC);

-- Atomic increment function for usage metering
CREATE OR REPLACE FUNCTION increment_usage(
  p_tenant_id UUID,
  p_calls BIGINT DEFAULT 1,
  p_blocked BIGINT DEFAULT 0
) RETURNS void AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Current billing period: first of current month to first of next month
  v_period_start := date_trunc('month', now());
  v_period_end := date_trunc('month', now()) + INTERVAL '1 month';

  INSERT INTO usage_meters (tenant_id, period_start, period_end, call_count, blocked_count)
  VALUES (p_tenant_id, v_period_start, v_period_end, p_calls, p_blocked)
  ON CONFLICT (tenant_id, period_start)
  DO UPDATE SET
    call_count = usage_meters.call_count + p_calls,
    blocked_count = usage_meters.blocked_count + p_blocked,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- RLS for usage_meters
ALTER TABLE usage_meters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_usage_meters" ON usage_meters
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub'
    )
  );
