-- ============================================================================
-- Add auth_headers column to mcp_servers for downstream HTTP authentication
-- ============================================================================

ALTER TABLE mcp_servers
  ADD COLUMN auth_headers JSONB;

COMMENT ON COLUMN mcp_servers.auth_headers IS 'HTTP headers to send to the downstream MCP server (e.g. Authorization). Stored as {"Header-Name": "value"}.';
