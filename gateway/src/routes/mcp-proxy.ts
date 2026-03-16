import { randomUUID } from "node:crypto";
import { Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import type { GatewayState } from "./types.js";

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
        state.transportLastActivity.set(sessionId, Date.now());
        const transport = state.mcpTransports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (req.method === "POST") {
        const sessionServer = engine.createSessionServer();
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
          state.transportLastActivity.set(sid, Date.now());
        }
      } else {
        res.status(400).json({ error: "Bad request: no valid session" });
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
