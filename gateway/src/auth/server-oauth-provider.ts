import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { McpServerRecord } from "../db/queries/servers.js";
import {
  updateServerOAuthTokens,
  updateServerOAuthClientRegistration,
  updateServerCodeVerifier,
} from "../db/queries/servers.js";

const OAUTH_CALLBACK_BASE_URL =
  process.env.OAUTH_CALLBACK_BASE_URL || "http://localhost:4000";

/**
 * MCP SDK OAuthClientProvider backed by the mcp_servers DB record.
 *
 * Static Maps are shared across provider instances so the callback route
 * (which creates a fresh provider for the same serverId) can access the
 * code verifier and pending auth URLs stored during the authorization flow.
 */
export class ServerOAuthProvider implements OAuthClientProvider {
  /** Pending authorization URLs — set by SDK, read by /authorize API route */
  static pendingAuthUrls = new Map<string, URL>();

  /** PKCE code verifiers — set before redirect, read during callback */
  static codeVerifiers = new Map<string, string>();

  private server: McpServerRecord;

  constructor(server: McpServerRecord) {
    this.server = server;
  }

  get redirectUrl(): string {
    return `${OAUTH_CALLBACK_BASE_URL}/api/oauth/callback/${this.server.id}`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "MCP Security Gateway",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    };
  }

  async clientInformation() {
    if (!this.server.oauthClientId) return undefined;
    return {
      client_id: this.server.oauthClientId,
      client_secret: this.server.oauthClientSecret ?? undefined,
    };
  }

  async saveClientInformation(info: { client_id: string; client_secret?: string }) {
    await updateServerOAuthClientRegistration(
      this.server.id,
      this.server.tenantId,
      {
        oauthClientId: info.client_id,
        oauthClientSecret: info.client_secret ?? null,
      }
    );
    // Update in-memory record so subsequent calls in same session see the new values
    this.server = {
      ...this.server,
      oauthClientId: info.client_id,
      oauthClientSecret: info.client_secret ?? null,
    };
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    if (!this.server.oauthAccessToken) return undefined;
    return {
      access_token: this.server.oauthAccessToken,
      token_type: "Bearer",
      refresh_token: this.server.oauthRefreshToken ?? undefined,
    };
  }

  async saveTokens(tokens: OAuthTokens) {
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(); // default 1hr

    await updateServerOAuthTokens(this.server.id, this.server.tenantId, {
      oauthAccessToken: tokens.access_token,
      oauthRefreshToken: tokens.refresh_token ?? this.server.oauthRefreshToken ?? null,
      oauthTokenExpiresAt: expiresAt,
    });

    // Clear the code verifier — no longer needed after token exchange
    ServerOAuthProvider.codeVerifiers.delete(this.server.id);
    await updateServerCodeVerifier(this.server.id, this.server.tenantId, null);

    // Update in-memory
    this.server = {
      ...this.server,
      oauthAccessToken: tokens.access_token,
      oauthRefreshToken: tokens.refresh_token ?? this.server.oauthRefreshToken,
      oauthTokenExpiresAt: expiresAt,
      oauthCodeVerifier: null,
    };
  }

  async redirectToAuthorization(authorizationUrl: URL) {
    // Store the URL so the /authorize API endpoint can return it to the admin
    ServerOAuthProvider.pendingAuthUrls.set(this.server.id, authorizationUrl);
    console.log(
      `[oauth] Authorization URL stored for server "${this.server.name}": ${authorizationUrl.toString()}`
    );
  }

  async saveCodeVerifier(codeVerifier: string) {
    // Persist to DB so the verifier survives container restarts
    ServerOAuthProvider.codeVerifiers.set(this.server.id, codeVerifier);
    await updateServerCodeVerifier(this.server.id, this.server.tenantId, codeVerifier);
  }

  async codeVerifier(): Promise<string> {
    // Check in-memory first, fall back to DB-persisted value
    const v = ServerOAuthProvider.codeVerifiers.get(this.server.id)
      ?? this.server.oauthCodeVerifier;
    if (!v) throw new Error(`No code verifier stored for server ${this.server.id}`);
    return v;
  }

  /**
   * Update the underlying server record (e.g., after re-fetching from DB).
   */
  updateServerRecord(server: McpServerRecord): void {
    this.server = server;
  }

  getServerId(): string {
    return this.server.id;
  }
}
