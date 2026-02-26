-- Sprint 5: Webhook Notification Channels
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage own webhooks" ON webhooks
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));
