/**
 * HTTP bootstrap for the self-hosted gateway.
 *
 * Wraps the proxy engine in an Express app exposing two endpoints:
 *   - `GET /health` — unauthenticated liveness probe
 *   - `ALL /mcp`   — Streamable HTTP transport for MCP clients, optionally
 *                    gated by API-key auth
 *
 * Multi-tenancy is out of scope here — the engine is bound to the default
 * tenant created by `SqliteStorageBackend`. Cloud deployments use a different
 * server layer with per-tenant engine multiplexing.
 */

import { randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Server as HttpServer } from "node:http";
import type {
  AuthProvider,
  GatewayProxyEngine,
} from "@mcpshield/gateway-core";

export interface HttpServerOptions {
  engine: GatewayProxyEngine;
  /** Optional AuthProvider — when omitted, /mcp is open (loopback only is recommended). */
  authProvider?: AuthProvider;
  host: string;
  port: number;
  /** CORS allowlist. Empty means same-origin only. */
  allowedOrigins?: string[];
}

export interface RunningServer {
  httpServer: HttpServer;
  close(): Promise<void>;
}

export async function startHttpServer(
  options: HttpServerOptions
): Promise<RunningServer> {
  const app = buildApp(options);

  return new Promise((resolveStart) => {
    const httpServer = app.listen(options.port, options.host, () => {
      console.log(
        `[mcpshield] listening on http://${options.host}:${options.port}`
      );
      console.log("  Health:   GET  /health");
      console.log("  MCP:      POST /mcp");
      resolveStart({
        httpServer,
        close: () =>
          new Promise<void>((resolveClose) => {
            httpServer.close(() => resolveClose());
          }),
      });
    });
  });
}

function buildApp(options: HttpServerOptions): Express {
  const { engine, authProvider, allowedOrigins } = options;
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const transportLastActivity = new Map<string, number>();

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "1mb" }));

  if (allowedOrigins && allowedOrigins.length > 0) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, DELETE, OPTIONS"
        );
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, mcp-session-id"
        );
      }
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", service: "mcpshield" });
  });

  app.all("/mcp", async (req: Request, res: Response) => {
    try {
      if (authProvider) {
        try {
          const principal = await authProvider.authenticate(req.headers);
          if (!principal) {
            res.status(401).json({
              error: "Missing or invalid credentials",
            });
            return;
          }
        } catch (err) {
          const status =
            err instanceof Error && "status" in err
              ? Number((err as { status?: number }).status) || 401
              : 401;
          res.status(status).json({
            error: err instanceof Error ? err.message : "Unauthorized",
          });
          return;
        }
      }

      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && transports.has(sessionId)) {
        transportLastActivity.set(sessionId, Date.now());
        const transport = transports.get(sessionId)!;
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
            transports.delete(sid);
            transportLastActivity.delete(sid);
          }
        };

        await sessionServer.connect(transport);
        await transport.handleRequest(req, res, req.body);

        const sid = transport.sessionId;
        if (sid) {
          transports.set(sid, transport);
          transportLastActivity.set(sid, Date.now());
        }
      } else {
        res.status(400).json({ error: "Bad request: no valid session" });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("[mcpshield] MCP proxy error:", msg);
      if (!res.headersSent) {
        res.status(500).json({ error: msg });
      }
    }
  });

  // Evict idle transports every minute (30min TTL)
  const TRANSPORT_TTL_MS = 30 * 60 * 1000;
  setInterval(() => {
    const now = Date.now();
    for (const [sid, lastActive] of transportLastActivity.entries()) {
      if (now - lastActive > TRANSPORT_TTL_MS) {
        const t = transports.get(sid);
        if (t) {
          try {
            t.close?.();
          } catch {
            // ignore
          }
          transports.delete(sid);
        }
        transportLastActivity.delete(sid);
      }
    }
  }, 60_000).unref();

  return app;
}
