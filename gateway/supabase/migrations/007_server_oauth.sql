-- ============================================================================
-- Add OAuth 2.0 columns to mcp_servers for token-based authentication
-- ============================================================================

ALTER TABLE mcp_servers
  ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'static',
  ADD COLUMN oauth_client_id TEXT,
  ADD COLUMN oauth_client_secret TEXT,
  ADD COLUMN oauth_refresh_token TEXT,
  ADD COLUMN oauth_access_token TEXT,
  ADD COLUMN oauth_token_expires_at TIMESTAMPTZ,
  ADD COLUMN oauth_token_url TEXT DEFAULT 'https://auth.atlassian.com/oauth/token',
  ADD COLUMN oauth_authorize_url TEXT DEFAULT 'https://auth.atlassian.com/authorize',
  ADD COLUMN oauth_scopes TEXT[];

COMMENT ON COLUMN mcp_servers.auth_type IS 'Authentication type: "static" (API key/basic auth in auth_headers) or "oauth2" (managed OAuth 2.0 tokens)';
COMMENT ON COLUMN mcp_servers.oauth_client_id IS 'OAuth 2.0 client ID for the Atlassian app';
COMMENT ON COLUMN mcp_servers.oauth_client_secret IS 'OAuth 2.0 client secret (encrypted at rest by Supabase)';
COMMENT ON COLUMN mcp_servers.oauth_refresh_token IS 'OAuth 2.0 refresh token for obtaining new access tokens';
COMMENT ON COLUMN mcp_servers.oauth_access_token IS 'Current OAuth 2.0 access token (cached, refreshable)';
COMMENT ON COLUMN mcp_servers.oauth_token_expires_at IS 'Expiry timestamp for the current access token';
COMMENT ON COLUMN mcp_servers.oauth_token_url IS 'OAuth 2.0 token endpoint URL';
COMMENT ON COLUMN mcp_servers.oauth_authorize_url IS 'OAuth 2.0 authorization endpoint URL';
COMMENT ON COLUMN mcp_servers.oauth_scopes IS 'Array of OAuth scopes requested';
