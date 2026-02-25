import { randomUUID } from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { GatewayProxyEngine } from "./proxy/engine.js";
import { requireAuth } from "./auth/middleware.js";
import type { AuthenticatedRequest } from "./auth/types.js";
import {
  getServersForTenant,
  createServer,
  updateServer,
  deleteServer,
} from "./db/queries/servers.js";
import {
  getAllPoliciesForTenant,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from "./db/queries/policies.js";
import { getAuditLogs, getAuditMetrics } from "./db/queries/audit.js";
import {
  getAlertsForTenant,
  acknowledgeAlert,
} from "./db/queries/alerts.js";
import { getSnapshotsForServer } from "./db/queries/snapshots.js";
import { RegisterServerSchema, PolicyRuleSchema } from "./schemas/index.js";
import type { AlertSeverity, AlertType } from "./schemas/index.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = express();

  // CORS — allow dashboard and local dev origins
  app.use((_req, res, next) => {
    const origin = _req.headers.origin;
    const allowed = [
      "http://localhost:3001",
      "https://dashboard-livid-eight-24.vercel.app",
    ];
    if (origin && (allowed.includes(origin) || origin.endsWith(".vercel.app"))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json());

  // Health check (unauthenticated)
  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", service: "mcp-security-gateway" });
  });

  // =========================================================================
  // MCP Proxy Endpoint
  // =========================================================================

  // Per-tenant gateway engines (keyed by tenantId) — engines persist across sessions
  const engines = new Map<string, GatewayProxyEngine>();
  // Session-based transports (keyed by MCP session ID)
  const mcpTransports = new Map<string, StreamableHTTPServerTransport>();

  async function getOrCreateEngine(
    tenantId: string,
    tenantContext: AuthenticatedRequest["tenant"]
  ): Promise<GatewayProxyEngine> {
    let engine = engines.get(tenantId);

    if (!engine) {
      engine = new GatewayProxyEngine();
      engine.setTenantContext(tenantContext!);
      engine.getAuditLogger().start();
      await engine.connectDownstreamServers(tenantId);
      engines.set(tenantId, engine);
    }

    return engine;
  }

  app.all("/mcp", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const engine = await getOrCreateEngine(
        req.tenant!.tenantId,
        req.tenant
      );

      // Check for existing session
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && mcpTransports.has(sessionId)) {
        const transport = mcpTransports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // New session: create a per-session Server + Transport pair
      if (req.method === "POST") {
        const sessionServer = engine.createSessionServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) mcpTransports.delete(sid);
        };

        await sessionServer.connect(transport);
        await transport.handleRequest(req, res, req.body);

        const sid = transport.sessionId;
        if (sid) mcpTransports.set(sid, transport);
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

  // =========================================================================
  // REST API — Server Management
  // =========================================================================

  app.get(
    "/api/servers",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const servers = await getServersForTenant(req.tenant!.tenantId);
        res.json({ servers });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/servers",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = RegisterServerSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const server = await createServer(req.tenant!.tenantId, parsed.data);
        res.status(201).json({ server });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.put(
    "/api/servers/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const server = await updateServer(
          req.params.id,
          req.tenant!.tenantId,
          req.body
        );
        res.json({ server });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.delete(
    "/api/servers/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await deleteServer(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Policy Management
  // =========================================================================

  app.get(
    "/api/policies",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const policies = await getAllPoliciesForTenant(req.tenant!.tenantId);
        res.json({ policies });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/policies",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = PolicyRuleSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const policy = await createPolicy(req.tenant!.tenantId, parsed.data);
        res.json({ policy });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.put(
    "/api/policies/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const policy = await updatePolicy(
          req.params.id,
          req.tenant!.tenantId,
          req.body
        );
        res.json({ policy });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.delete(
    "/api/policies/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await deletePolicy(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Audit Logs
  // =========================================================================

  app.get(
    "/api/audit",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await getAuditLogs(req.tenant!.tenantId, {
          limit: Number(req.query.limit) || 50,
          offset: Number(req.query.offset) || 0,
          serverId: req.query.serverId as string | undefined,
          toolName: req.query.toolName as string | undefined,
          startDate: req.query.startDate as string | undefined,
          endDate: req.query.endDate as string | undefined,
        });
        res.json(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/audit/metrics",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const since =
          (req.query.since as string) ||
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const metrics = await getAuditMetrics(req.tenant!.tenantId, since);
        res.json(metrics);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Alerts
  // =========================================================================

  app.get(
    "/api/alerts",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await getAlertsForTenant(req.tenant!.tenantId, {
          limit: Number(req.query.limit) || 50,
          offset: Number(req.query.offset) || 0,
          acknowledged:
            req.query.acknowledged === "true"
              ? true
              : req.query.acknowledged === "false"
                ? false
                : undefined,
          severity: req.query.severity as AlertSeverity | undefined,
          type: req.query.type as AlertType | undefined,
        });
        res.json(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/alerts/:id/acknowledge",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await acknowledgeAlert(
          req.params.id,
          req.tenant!.tenantId,
          req.tenant!.userId
        );
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Tool Snapshots
  // =========================================================================

  app.get(
    "/api/servers/:serverId/snapshots",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const snapshots = await getSnapshotsForServer(
          req.tenant!.tenantId,
          req.params.serverId
        );
        res.json({ snapshots });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // Start server
  // =========================================================================

  app.listen(config.port, () => {
    console.log(
      `MCP Security Gateway running on http://localhost:${config.port}`
    );
    console.log(`  MCP proxy: POST /mcp`);
    console.log(`  REST API:  /api/*`);
    console.log(`  Health:    GET /health`);
  });
}

main().catch((error) => {
  console.error("Gateway startup error:", error);
  process.exit(1);
});
