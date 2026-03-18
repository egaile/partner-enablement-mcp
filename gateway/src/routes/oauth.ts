import { Router } from "express";
import { randomBytes } from "node:crypto";
import { auth as mcpAuth } from "@modelcontextprotocol/sdk/client/auth.js";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import { getServerById } from "../db/queries/servers.js";
import { ServerOAuthProvider } from "../auth/server-oauth-provider.js";
import type { GatewayState } from "./types.js";

export function createOAuthRouter(state: GatewayState): Router {
  const router = Router();

  router.get(
    "/api/servers/:id/oauth/authorize",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const server = await getServerById(req.params.id, req.tenant!.tenantId);
        if (!server) {
          res.status(404).json({ error: "Server not found" });
          return;
        }
        if (server.authType !== "oauth2") {
          res.status(400).json({ error: "Server is not configured for OAuth. Set authType to \"oauth2\" first." });
          return;
        }
        if (!server.url) {
          res.status(400).json({ error: "Server URL is required for OAuth" });
          return;
        }

        state.oauthTenantMap.set(server.id, req.tenant!.tenantId);

        // Generate a random state nonce for CSRF protection
        const stateNonce = randomBytes(32).toString("hex");
        state.oauthStateMap.set(stateNonce, server.id);

        const engine = state.engines.get(req.tenant!.tenantId);
        let provider: ServerOAuthProvider;
        if (engine) {
          const existing = engine.getConnectionManager().getOAuthProvider(server.id);
          if (existing) {
            existing.updateServerRecord(server);
            provider = existing;
          } else {
            provider = new ServerOAuthProvider(server);
          }
        } else {
          provider = new ServerOAuthProvider(server);
        }

        let authUrl = ServerOAuthProvider.pendingAuthUrls.get(server.id);
        if (!authUrl) {
          const result = await mcpAuth(provider, {
            serverUrl: server.url,
            scope: server.oauthScopes?.join(' '),
          });
          if (result === "AUTHORIZED") {
            res.json({ status: "already_authorized", message: "Server already has valid tokens" });
            return;
          }
          authUrl = ServerOAuthProvider.pendingAuthUrls.get(server.id);
        }

        if (!authUrl) {
          res.status(500).json({ error: "Failed to obtain authorization URL from OAuth discovery" });
          return;
        }

        ServerOAuthProvider.pendingAuthUrls.delete(server.id);

        // Append state nonce to the authorization URL for CSRF protection
        const authUrlWithState = new URL(authUrl.toString());
        authUrlWithState.searchParams.set("state", stateNonce);
        res.json({ authorizeUrl: authUrlWithState.toString() });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.get(
    "/api/oauth/callback/:serverId",
    async (req, res) => {
      try {
        const serverId = req.params.serverId;
        const { code, error: oauthError, state: stateParam } = req.query;

        if (oauthError) {
          res.status(400).send(`OAuth error: ${oauthError}`);
          return;
        }
        if (!code) {
          res.status(400).send("Missing authorization code");
          return;
        }

        // Validate the state parameter against our stored nonces (CSRF protection)
        if (!stateParam || typeof stateParam !== "string") {
          res.status(400).send("Missing state parameter");
          return;
        }
        const expectedServerId = state.oauthStateMap.get(stateParam);
        if (!expectedServerId || expectedServerId !== serverId) {
          res.status(403).send("Invalid or expired state parameter. Please re-initiate the OAuth flow.");
          return;
        }
        state.oauthStateMap.delete(stateParam);

        const tenantId = state.oauthTenantMap.get(serverId);
        if (!tenantId) {
          res.status(403).send("Unknown server or session expired. Please re-initiate the OAuth flow.");
          return;
        }

        const server = await getServerById(serverId, tenantId);
        if (!server) {
          res.status(404).send("Server not found");
          return;
        }

        const engine = state.engines.get(tenantId);
        let provider: ServerOAuthProvider;
        if (engine) {
          const existing = engine.getConnectionManager().getOAuthProvider(serverId);
          if (existing) {
            existing.updateServerRecord(server);
            provider = existing;
          } else {
            provider = new ServerOAuthProvider(server);
          }
        } else {
          provider = new ServerOAuthProvider(server);
        }

        const codeVerifier = await provider.codeVerifier();
        const clientInfo = await provider.clientInformation();
        if (!clientInfo) {
          res.status(500).send("Missing OAuth client information. Please re-initiate the OAuth flow.");
          return;
        }

        const tokenUrl = server.oauthTokenUrl ?? "https://auth.atlassian.com/oauth/token";
        const tokenParams = new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: provider.redirectUrl,
          client_id: clientInfo.client_id,
          code_verifier: codeVerifier,
        });
        if (clientInfo.client_secret) {
          tokenParams.set("client_secret", clientInfo.client_secret);
        }

        const tokenResponse = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenParams.toString(),
        });

        if (!tokenResponse.ok) {
          const errorBody = await tokenResponse.text().catch(() => "");
          console.error(`[oauth] Token exchange failed (HTTP ${tokenResponse.status}):`, errorBody);
          res.status(500).send(`Token exchange failed: ${errorBody}`);
          return;
        }

        const tokenData = await tokenResponse.json() as {
          access_token: string;
          token_type?: string;
          expires_in?: number;
          refresh_token?: string;
          scope?: string;
        };

        await provider.saveTokens({
          access_token: tokenData.access_token,
          token_type: tokenData.token_type ?? "Bearer",
          expires_in: tokenData.expires_in,
          refresh_token: tokenData.refresh_token,
        });

        state.oauthTenantMap.delete(serverId);
        ServerOAuthProvider.codeVerifiers.delete(serverId);

        if (engine) {
          try {
            const updatedServer = await getServerById(serverId, tenantId);
            if (updatedServer) {
              engine.getConnectionManager().updateServerRecord(updatedServer);
            }
            await engine.getConnectionManager().reconnect(serverId);
          } catch (reconnErr) {
            console.error("[oauth] Reconnect after token exchange failed:", reconnErr);
          }
        }

        res.send(
          `<html><body><h2>OAuth setup complete</h2>` +
          `<p>Authorization successful. You can close this tab.</p></body></html>`
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("[oauth] Callback error:", msg);
        res.status(500).send(`OAuth callback error: ${msg}`);
      }
    }
  );

  router.get(
    "/api/servers/:id/oauth/status",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const server = await getServerById(req.params.id, req.tenant!.tenantId);
        if (!server) {
          res.status(404).json({ error: "Server not found" });
          return;
        }

        res.json({
          authType: server.authType,
          configured: server.authType === "oauth2" && !!server.oauthClientId,
          hasToken: !!server.oauthAccessToken,
          expiresAt: server.oauthTokenExpiresAt,
          scopes: server.oauthScopes,
          hasRefreshToken: !!server.oauthRefreshToken,
        });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
