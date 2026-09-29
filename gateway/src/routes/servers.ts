import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import {
  getServersForTenant,
  getServerById,
  createServer,
  updateServer,
  deleteServer,
} from "../db/queries/servers.js";
import { RegisterServerSchema, UpdateServerSchema } from "../schemas/index.js";
import { getServerCount } from "../db/queries/billing.js";
import { getPlan } from "../billing/plans.js";
import type { GatewayState } from "./types.js";
import type { McpServerRecord } from "@mcpshield/gateway-core/storage";

function redactValues(
  values: Record<string, string> | null
): Record<string, string> | null {
  if (!values) return null;
  return Object.fromEntries(Object.keys(values).map((k) => [k, "[redacted]"]));
}

/**
 * Some providers put credentials in the URL (`user:pass@host`, `?token=...`).
 * Keep the origin and path, drop userinfo and the fragment, and keep query
 * parameter names with their values redacted.
 */
export function redactUrl(raw: string | null): string | null {
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "[redacted]";
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    url.searchParams.set(key, "[redacted]");
  }
  return url.toString();
}

// Credentials never leave the gateway. This is an explicit allowlist, so a new
// column on McpServerRecord stays private until someone adds it here. Key
// names of headers/env stay visible so the UI can show what's configured.
// Token presence is reported by GET /api/servers/:id/oauth/status.
export function toPublicServer(server: McpServerRecord) {
  return {
    id: server.id,
    tenantId: server.tenantId,
    name: server.name,
    transport: server.transport,
    url: redactUrl(server.url),
    env: redactValues(server.env),
    authHeaders: redactValues(server.authHeaders),
    enabled: server.enabled,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
    authType: server.authType,
    oauthClientId: server.oauthClientId,
    oauthTokenExpiresAt: server.oauthTokenExpiresAt,
    oauthTokenUrl: server.oauthTokenUrl,
    oauthAuthorizeUrl: server.oauthAuthorizeUrl,
    oauthScopes: server.oauthScopes,
  };
}

export function createServersRouter(state: GatewayState): Router {
  const router = Router();

  router.get(
    "/api/servers",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const servers = await getServersForTenant(req.tenant!.tenantId);
        res.json({ servers: servers.map(toPublicServer) });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/servers",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const currentCount = await getServerCount(req.tenant!.tenantId);
        const plan = getPlan(req.tenant!.plan ?? "starter");
        if (currentCount >= plan.maxServers) {
          res.status(402).json({
            error: `Server limit reached (${plan.maxServers} on ${plan.name} plan). Please upgrade to add more servers.`,
            currentCount,
            limit: plan.maxServers,
            plan: plan.id,
          });
          return;
        }

        const parsed = RegisterServerSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const server = await createServer(req.tenant!.tenantId, parsed.data);
        res.status(201).json({ server: toPublicServer(server) });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.put(
    "/api/servers/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = UpdateServerSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const server = await updateServer(
          req.params.id,
          req.tenant!.tenantId,
          parsed.data
        );
        res.json({ server: toPublicServer(server) });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.delete(
    "/api/servers/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await deleteServer(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
