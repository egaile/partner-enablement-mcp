import type { McpServerRecord } from "../db/queries/servers.js";
import { updateServerOAuthTokens } from "../db/queries/servers.js";

interface CachedToken {
  accessToken: string;
  expiresAt: Date;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/**
 * Manages OAuth 2.0 tokens for downstream MCP servers.
 * Handles proactive refresh, force refresh on 401, and one-time code exchange.
 */
export class OAuthManager {
  /** In-memory token cache keyed by serverId */
  private tokenCache = new Map<string, CachedToken>();

  /** Mutex to prevent concurrent refreshes for the same server */
  private refreshLocks = new Map<string, Promise<string>>();

  /** Buffer before expiry to trigger proactive refresh (5 minutes) */
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000;

  /**
   * Get a valid access token for an OAuth server.
   * Returns cached token if still valid, otherwise refreshes.
   */
  async getAccessToken(server: McpServerRecord): Promise<string> {
    if (server.authType !== "oauth2") {
      throw new Error(`Server "${server.name}" is not configured for OAuth`);
    }

    const cached = this.tokenCache.get(server.id);
    if (cached && cached.expiresAt.getTime() > Date.now() + this.REFRESH_BUFFER_MS) {
      return cached.accessToken;
    }

    // Check DB-stored token (may have been refreshed by another instance)
    if (server.oauthAccessToken && server.oauthTokenExpiresAt) {
      const expiresAt = new Date(server.oauthTokenExpiresAt);
      if (expiresAt.getTime() > Date.now() + this.REFRESH_BUFFER_MS) {
        this.tokenCache.set(server.id, {
          accessToken: server.oauthAccessToken,
          expiresAt,
        });
        return server.oauthAccessToken;
      }
    }

    // Need to refresh
    return this.forceRefresh(server);
  }

  /**
   * Proactively check and refresh if token is expiring soon.
   * Returns true if a refresh was performed.
   */
  async refreshIfNeeded(server: McpServerRecord): Promise<boolean> {
    if (server.authType !== "oauth2") return false;
    if (!server.oauthRefreshToken) return false;

    const cached = this.tokenCache.get(server.id);
    const expiresAt = cached?.expiresAt
      ?? (server.oauthTokenExpiresAt ? new Date(server.oauthTokenExpiresAt) : null);

    if (!expiresAt) return false;

    if (expiresAt.getTime() > Date.now() + this.REFRESH_BUFFER_MS) {
      return false; // Still valid
    }

    await this.forceRefresh(server);
    return true;
  }

  /**
   * Force refresh the access token (e.g., after a 401).
   * Uses a mutex to prevent concurrent refreshes for the same server.
   */
  async forceRefresh(server: McpServerRecord): Promise<string> {
    // Check for an in-flight refresh
    const existing = this.refreshLocks.get(server.id);
    if (existing) {
      return existing;
    }

    const refreshPromise = this.doRefresh(server);
    this.refreshLocks.set(server.id, refreshPromise);

    try {
      const token = await refreshPromise;
      return token;
    } finally {
      this.refreshLocks.delete(server.id);
    }
  }

  /**
   * Exchange an authorization code for tokens (one-time setup).
   */
  async exchangeCode(
    server: McpServerRecord,
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    if (!server.oauthClientId || !server.oauthClientSecret) {
      throw new Error(`Server "${server.name}" missing OAuth client credentials`);
    }

    const tokenUrl = server.oauthTokenUrl ?? "https://auth.atlassian.com/oauth/token";

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: server.oauthClientId,
        client_secret: server.oauthClientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as TokenResponse;
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Cache in memory
    this.tokenCache.set(server.id, {
      accessToken: data.access_token,
      expiresAt,
    });

    // Persist to DB
    await updateServerOAuthTokens(server.id, server.tenantId, {
      oauthAccessToken: data.access_token,
      oauthRefreshToken: data.refresh_token ?? server.oauthRefreshToken ?? null,
      oauthTokenExpiresAt: expiresAt.toISOString(),
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? server.oauthRefreshToken ?? "",
      expiresAt,
    };
  }

  /**
   * Build the Atlassian OAuth authorize URL for browser redirect.
   */
  buildAuthorizeUrl(
    server: McpServerRecord,
    redirectUri: string,
    state: string
  ): string {
    const authorizeUrl = server.oauthAuthorizeUrl ?? "https://auth.atlassian.com/authorize";
    const scopes = server.oauthScopes?.join(" ") ?? "read:jira-work read:jira-user offline_access";

    const params = new URLSearchParams({
      audience: "api.atlassian.com",
      client_id: server.oauthClientId ?? "",
      scope: scopes,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      prompt: "consent",
    });

    return `${authorizeUrl}?${params.toString()}`;
  }

  /**
   * Clear cached token for a server (e.g., on disconnect).
   */
  clearCache(serverId: string): void {
    this.tokenCache.delete(serverId);
    this.refreshLocks.delete(serverId);
  }

  private async doRefresh(server: McpServerRecord): Promise<string> {
    if (!server.oauthRefreshToken) {
      throw new Error(
        `Server "${server.name}" has no refresh token. Complete the OAuth setup flow first.`
      );
    }
    if (!server.oauthClientId || !server.oauthClientSecret) {
      throw new Error(`Server "${server.name}" missing OAuth client credentials`);
    }

    const tokenUrl = server.oauthTokenUrl ?? "https://auth.atlassian.com/oauth/token";

    console.log(`[oauth] Refreshing token for server "${server.name}" (${server.id})`);

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: server.oauthClientId,
        client_secret: server.oauthClientSecret,
        refresh_token: server.oauthRefreshToken,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as TokenResponse;
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Cache in memory
    this.tokenCache.set(server.id, {
      accessToken: data.access_token,
      expiresAt,
    });

    // Persist to DB (refresh token may rotate)
    await updateServerOAuthTokens(server.id, server.tenantId, {
      oauthAccessToken: data.access_token,
      oauthRefreshToken: data.refresh_token ?? server.oauthRefreshToken,
      oauthTokenExpiresAt: expiresAt.toISOString(),
    });

    // Update the server record's in-memory fields for subsequent calls
    (server as { oauthAccessToken: string }).oauthAccessToken = data.access_token;
    (server as { oauthTokenExpiresAt: string }).oauthTokenExpiresAt = expiresAt.toISOString();
    if (data.refresh_token) {
      (server as { oauthRefreshToken: string }).oauthRefreshToken = data.refresh_token;
    }

    console.log(`[oauth] Token refreshed for "${server.name}", expires at ${expiresAt.toISOString()}`);

    return data.access_token;
  }
}
