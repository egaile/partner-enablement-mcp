import { randomUUID } from "node:crypto";
import { Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import type { GatewayState } from "./types.js";

// A session id is not a credential. Remember who opened each session and
// refuse to let anyone else drive it.
const sessionOwners = new WeakMap<StreamableHTTPServerTransport, string>();

function ownerKey(tenant: { tenantId: string; userId: string }): string {
  return `${tenant.tenantId}:${tenant.userId}`;
}

export function createMcpProxyRouter(state: GatewayState): Router {
  const router = Router();

  router.all("/mcp", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const engine = await state.getOrCreateEngine(
        req.tenant!.tenantId,
        req.tenant
      );

      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && state.mcpTransports.has(sessionId)) {
        const transport = state.mcpTransports.get(sessionId)!;
        if (sessionOwners.get(transport) !== ownerKey(req.tenant!)) {
          res.status(403).json({ error: "Session belongs to a different caller" });
          return;
        }
        // Only the owner keeps the session alive.
        state.transportLastActivity.set(sessionId, Date.now());
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (req.method === "POST") {
        const sessionServer = engine.createSessionServer(req.tenant!);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            state.mcpTransports.delete(sid);
            state.transportLastActivity.delete(sid);
          }
        };

        await sessionServer.connect(transport);
        await transport.handleRequest(req, res, req.body);

        const sid = transport.sessionId;
        if (sid) {
          state.mcpTransports.set(sid, transport);
          sessionOwners.set(transport, ownerKey(req.tenant!));
          state.transportLastActivity.set(sid, Date.now());
        }
      } else if (req.method === "GET" || req.method === "DELETE") {
        res.status(400).json({ error: "Bad request: no valid session" });
      } else {
        res.status(405).json({ error: "Method not allowed" });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("[gateway] MCP proxy error:", msg);
      if (!res.headersSent) {
        res.status(500).json({ error: msg });
      }
    }
  });

  return router;
}
