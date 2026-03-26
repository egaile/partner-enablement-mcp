-- Persist OAuth state nonce to survive container restarts during OAuth flow.
-- Only one pending OAuth flow per server at a time.
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_state_nonce TEXT;
