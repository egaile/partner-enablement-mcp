import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { createJiraClient } from "./services/jiraClient.js";
import { knowledgeBase } from "./services/knowledgeBase.js";
import {
  registerReadProjectContext,
  registerGenerateArchitecture,
  registerAssessCompliance,
  registerCreateImplementationPlan
} from "./tools/index.js";

// Shared services (stateless, safe to reuse across sessions)
const jiraClient = createJiraClient();

function registerTools(server: McpServer): void {
  registerReadProjectContext(server, jiraClient);
  registerGenerateArchitecture(server, knowledgeBase);
  registerAssessCompliance(server, knowledgeBase);
  registerCreateImplementationPlan(server, knowledgeBase);
}

/**
 * Factory: create a fresh McpServer with all tools registered.
 * Each MCP session needs its own McpServer instance because the SDK
 * only allows one transport connection per Server instance.
 */
function createMcpServerInstance(): McpServer {
  const server = new McpServer({
    name: "partner-enablement-mcp-server",
    version: "1.0.0"
  });
  registerTools(server);
  return server;
}

// =============================================================================
// Server Transport Setup
// =============================================================================
async function runStdio(): Promise<void> {
  const server = createMcpServerInstance();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Partner Enablement MCP Server running on stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  const port = parseInt(process.env.PORT || "3000");

  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", server: "partner-enablement-mcp-server" });
  });

  // Per-session McpServer + Transport pairs (SDK requires one Server per transport)
  const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

  // Stale session cleanup — evict sessions with no activity for 30 minutes
  const SESSION_TTL_MS = 30 * 60 * 1000;
  const sessionLastActivity = new Map<string, number>();

  setInterval(() => {
    const now = Date.now();
    for (const [sid, lastActive] of sessionLastActivity.entries()) {
      if (now - lastActive > SESSION_TTL_MS) {
        const session = sessions.get(sid);
        if (session) {
          session.transport.close?.();
          sessions.delete(sid);
        }
        sessionLastActivity.delete(sid);
      }
    }
  }, 60_000);

  app.all("/mcp", async (req, res) => {
    // Route to existing session
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      sessionLastActivity.set(sessionId, Date.now());
      try {
        await session.transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("[mcp] handleRequest error:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: String(error) });
        }
      }
      return;
    }

    // New session — create fresh McpServer + Transport
    if (req.method === "POST") {
      try {
        const sessionServer = createMcpServerInstance();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            sessions.delete(sid);
            sessionLastActivity.delete(sid);
          }
        };

        await sessionServer.connect(transport);
        await transport.handleRequest(req, res, req.body);

        const sid = transport.sessionId;
        if (sid) {
          sessions.set(sid, { server: sessionServer, transport });
          sessionLastActivity.set(sid, Date.now());
        }
      } catch (error) {
        console.error("[mcp] handleRequest error:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: String(error) });
        }
      }
    } else {
      res.status(400).json({ error: "No valid session. Send an initialize request first." });
    }
  });

  const httpServer = app.listen(port, () => {
    console.error(`Partner Enablement MCP Server running on http://localhost:${port}/mcp`);
  });

  // Graceful shutdown
  async function shutdown(signal: string) {
    console.error(`\n[mcp-server] ${signal} received. Shutting down gracefully...`);

    httpServer.close();

    // Close all active sessions
    for (const [sid, session] of sessions.entries()) {
      try {
        session.transport.close?.();
      } catch {
        // ignore
      }
      sessions.delete(sid);
    }
    sessionLastActivity.clear();

    console.error("[mcp-server] Shutdown complete.");
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// =============================================================================
// Entry Point
// =============================================================================
const mode = process.env.TRANSPORT || process.argv[2] || "stdio";

if (mode === "http") {
  runHTTP().catch((error) => {
    console.error("HTTP server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Stdio server error:", error);
    process.exit(1);
  });
}
