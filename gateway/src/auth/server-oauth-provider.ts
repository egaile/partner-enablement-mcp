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

/** Refresh tokens 5 minutes before they expire */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

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

  /** Prevents concurrent refresh attempts for the same server */
  private static refreshLocks = new Map<string, Promise<OAuthTokens | null>>();

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

    // Check if token is expired or about to expire
    if (this.isTokenExpired() && this.server.oauthRefreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return refreshed;
      }
      // Refresh failed — return existing token and let SDK handle the 401
      console.warn(`[oauth] Token refresh failed for "${this.server.name}", returning stale token`);
    }

    return {
      access_token: this.server.oauthAccessToken,
      token_type: "Bearer",
      refresh_token: this.server.oauthRefreshToken ?? undefined,
    };
  }

  /**
   * Check whether the access token is expired or will expire within the buffer window.
   */
  private isTokenExpired(): boolean {
    if (!this.server.oauthTokenExpiresAt) return false;
    const expiresAt = new Date(this.server.oauthTokenExpiresAt).getTime();
    return Date.now() >= expiresAt - TOKEN_REFRESH_BUFFER_MS;
  }

  /**
   * Exchange the refresh token for a new access token directly with the token endpoint.
   * Uses a lock to prevent concurrent refresh attempts for the same server.
   */
  private async refreshAccessToken(): Promise<OAuthTokens | null> {
    const serverId = this.server.id;

    // Deduplicate concurrent refresh attempts
    const existingLock = ServerOAuthProvider.refreshLocks.get(serverId);
    if (existingLock) {
      return existingLock;
    }

    const refreshPromise = this.doRefresh();
    ServerOAuthProvider.refreshLocks.set(serverId, refreshPromise);

    try {
      return await refreshPromise;
    } finally {
      ServerOAuthProvider.refreshLocks.delete(serverId);
    }
  }

  private async doRefresh(): Promise<OAuthTokens | null> {
    const tokenUrl = this.server.oauthTokenUrl ?? "https://auth.atlassian.com/oauth/token";
    const refreshToken = this.server.oauthRefreshToken;
    const clientId = this.server.oauthClientId;
    const clientSecret = this.server.oauthClientSecret;

    if (!refreshToken || !clientId) {
      console.warn(`[oauth] Cannot refresh: missing refresh_token or client_id for "${this.server.name}"`);
      return null;
    }

    console.log(`[oauth] Refreshing access token for "${this.server.name}"...`);

    try {
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      });
      if (clientSecret) {
        params.set("client_secret", clientSecret);
      }

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`[oauth] Token refresh failed (HTTP ${response.status}) for "${this.server.name}": ${errorText}`);
        return null;
      }

      const data = await response.json() as {
        access_token: string;
        token_type?: string;
        expires_in?: number;
        refresh_token?: string;
        scope?: string;
      };

      const tokens: OAuthTokens = {
        access_token: data.access_token,
        token_type: data.token_type ?? "Bearer",
        expires_in: data.expires_in,
        refresh_token: data.refresh_token ?? refreshToken,
      };

      // Persist new tokens to DB and update in-memory state
      await this.saveTokens(tokens);

      console.log(`[oauth] Successfully refreshed token for "${this.server.name}" (expires in ${data.expires_in ?? "unknown"}s)`);
      return tokens;
    } catch (err) {
      console.error(`[oauth] Token refresh error for "${this.server.name}":`, err instanceof Error ? err.message : err);
      return null;
    }
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
   * Called by the MCP SDK when it detects invalid credentials.
   * Clears stored tokens/client info so the next auth attempt starts fresh.
   */
  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier"): Promise<void> {
    console.log(`[oauth] Invalidating credentials (scope: ${scope}) for "${this.server.name}"`);

    if (scope === "tokens" || scope === "all") {
      await updateServerOAuthTokens(this.server.id, this.server.tenantId, {
        oauthAccessToken: null,
        oauthRefreshToken: scope === "all" ? null : this.server.oauthRefreshToken,
        oauthTokenExpiresAt: null,
      });
      this.server = {
        ...this.server,
        oauthAccessToken: null,
        oauthRefreshToken: scope === "all" ? null : this.server.oauthRefreshToken,
        oauthTokenExpiresAt: null,
      };
    }

    if (scope === "client" || scope === "all") {
      await updateServerOAuthClientRegistration(this.server.id, this.server.tenantId, {
        oauthClientId: null,
        oauthClientSecret: null,
      });
      this.server = {
        ...this.server,
        oauthClientId: null,
        oauthClientSecret: null,
      };
    }

    if (scope === "verifier" || scope === "all") {
      ServerOAuthProvider.codeVerifiers.delete(this.server.id);
      await updateServerCodeVerifier(this.server.id, this.server.tenantId, null);
    }
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
