-- The PKCE code verifier was written by the gateway (db/queries/servers.ts)
-- but no earlier migration created the column. Encrypted at rest when
-- TOKEN_ENCRYPTION_KEY is set, same as the other OAuth fields.
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_code_verifier TEXT;
