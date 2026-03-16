import express from "express";
import helmet from "helmet";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { GatewayProxyEngine } from "./proxy/engine.js";
import type { AuthenticatedRequest } from "./auth/types.js";
import { registerRoutes } from "./routes/index.js";
import type { GatewayState } from "./routes/types.js";

/** Sanitize error messages for API responses — strip internal details in production */
function safeErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : "Unknown error";
  if (process.env.NODE_ENV === "production") {
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) return "Service temporarily unavailable";
    if (msg.includes("supabase") || msg.includes("postgres")) return "Database operation failed";
    if (/\/[a-z].*\.[jt]s/i.test(msg)) return "Internal server error";
  }
  return msg;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const app = express();

  // Security headers
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS — configurable via ALLOWED_ORIGINS env var
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (!allowedOrigins.includes("http://localhost:3001")) {
    allowedOrigins.push("http://localhost:3001");
  }

  app.use((_req, res, next) => {
    const origin = _req.headers.origin;
    if (origin && allowedOrigins.some((allowed) => origin === allowed || origin.endsWith(".vercel.app"))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id, X-API-Key");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Request size limit
  app.use(express.json({ limit: "1mb" }));

  // Health check (unauthenticated)
  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", service: "mcp-security-gateway" });
  });

  // =========================================================================
  // Shared State
  // =========================================================================

  const engines = new Map<string, GatewayProxyEngine>();
  const mcpTransports = new Map<string, StreamableHTTPServerTransport>();
  const transportLastActivity = new Map<string, number>();
  const oauthTenantMap = new Map<string, string>();

  // Rec 4: Engine idle timeout — evict engines with no activity for 60 minutes
  const ENGINE_IDLE_TTL_MS = 60 * 60 * 1000;
  const engineLastActivity = new Map<string, number>();
  const pendingShutdowns = new Set<Promise<void>>();

  async function getOrCreateEngine(
    tenantId: string,
    tenantContext: AuthenticatedRequest["tenant"]
  ): Promise<GatewayProxyEngine> {
    let engine = engines.get(tenantId);

    if (!engine) {
      engine = new GatewayProxyEngine();
      engine.setTenantContext(tenantContext!);
      engine.getAuditLogger().start();
      engine.getUsageMeter().start();
      await engine.connectDownstreamServers(tenantId);
      engines.set(tenantId, engine);
    }

    engineLastActivity.set(tenantId, Date.now());
    return engine;
  }

  // Stale transport cleanup — evict transports with no activity for 30 minutes
  const TRANSPORT_TTL_MS = 30 * 60 * 1000;

  setInterval(() => {
    const now = Date.now();
    for (const [sid, lastActive] of transportLastActivity.entries()) {
      if (now - lastActive > TRANSPORT_TTL_MS) {
        const transport = mcpTransports.get(sid);
        if (transport) {
          transport.close?.();
          mcpTransports.delete(sid);
        }
        transportLastActivity.delete(sid);
      }
    }
  }, 60_000);

  // Rec 4: Idle engine eviction — shut down engines with no activity
  setInterval(() => {
    const now = Date.now();
    for (const [tenantId, lastActive] of engineLastActivity.entries()) {
      if (now - lastActive > ENGINE_IDLE_TTL_MS) {
        const engine = engines.get(tenantId);
        if (engine) {
          console.log(`[gateway] Evicting idle engine for tenant ${tenantId}`);
          const p = engine.shutdown().catch((err) => {
            console.error(`[gateway] Error shutting down idle engine for ${tenantId}:`, err);
          }).finally(() => pendingShutdowns.delete(p));
          pendingShutdowns.add(p);
          engines.delete(tenantId);
        }
        engineLastActivity.delete(tenantId);
      }
    }
  }, 5 * 60_000);

  // =========================================================================
  // Register all route modules
  // =========================================================================

  const state: GatewayState = {
    engines,
    mcpTransports,
    transportLastActivity,
    oauthTenantMap,
    allowedOrigins,
    getOrCreateEngine,
    safeErrorMessage,
  };

  registerRoutes(app, state);

  // =========================================================================
  // Start server
  // =========================================================================

  const server = app.listen(config.port, () => {
    console.log(
      `MCP Security Gateway running on http://localhost:${config.port}`
    );
    console.log(`  MCP proxy: POST /mcp`);
    console.log(`  REST API:  /api/*`);
    console.log(`  Health:    GET /health`);
  });

  // Graceful shutdown
  async function shutdown(signal: string) {
    console.log(`\n[gateway] ${signal} received. Shutting down gracefully...`);

    server.close();

    // Flush audit logs and disconnect downstream servers
    for (const engine of engines.values()) {
      try {
        await engine.shutdown();
      } catch (err) {
        console.error("[gateway] Error during engine shutdown:", err);
      }
    }

    // Wait for any in-flight idle eviction shutdowns
    await Promise.allSettled(pendingShutdowns);

    // Close MCP transports
    for (const transport of mcpTransports.values()) {
      try {
        transport.close?.();
      } catch {
        // ignore
      }
    }

    console.log("[gateway] Shutdown complete.");
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("Gateway startup error:", error);
  process.exit(1);
});
