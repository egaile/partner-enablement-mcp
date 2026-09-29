import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

vi.mock("../../auth/middleware.js", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.tenant = {
      tenantId: String(req.headers["x-test-tenant"] ?? "t1"),
      tenantName: "Demo",
      userId: String(req.headers["x-test-user"] ?? "alice"),
      userRole: "member",
    };
    next();
  },
}));

const { createMcpProxyRouter } = await import("../mcp-proxy.js");

const createSessionServer = vi.fn((_ctx?: unknown) => {
  const server = new Server(
    { name: "test-gateway", version: "0.0.0" },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
  return server;
});

const mcpTransports = new Map<string, StreamableHTTPServerTransport>();
const state = {
  engines: new Map(),
  mcpTransports,
  transportLastActivity: new Map<string, number>(),
  allowedOrigins: [],
  getOrCreateEngine: async () => ({ createSessionServer }),
  safeErrorMessage: (e: unknown) => String(e),
} as never;

let http: HttpServer | undefined;
afterEach(async () => {
  for (const t of mcpTransports.values()) await t.close();
  mcpTransports.clear();
  createSessionServer.mockClear();
  await new Promise<void>((r) => (http ? http.close(() => r()) : r()));
  http = undefined;
});

async function start(): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use(createMcpProxyRouter(state));
  http = app.listen(0, "127.0.0.1");
  await new Promise((r) => http!.once("listening", r));
  return `http://127.0.0.1:${(http!.address() as AddressInfo).port}/mcp`;
}

function post(
  url: string,
  body: unknown,
  caller: { tenant: string; user: string },
  sessionId?: string
) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-test-tenant": caller.tenant,
      "x-test-user": caller.user,
      ...(sessionId
        ? { "mcp-session-id": sessionId, "mcp-protocol-version": "2025-03-26" }
        : {}),
    },
    body: JSON.stringify(body),
  });
}

async function openSession(url: string, caller: { tenant: string; user: string }) {
  const res = await post(
    url,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    },
    caller
  );
  expect(res.status).toBe(200);
  const sid = res.headers.get("mcp-session-id");
  expect(sid).toBeTruthy();
  return sid!;
}

const LIST = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };

describe("/mcp session ownership", () => {
  it("binds the session server to the caller and lets that caller reuse the session", async () => {
    const url = await start();
    const alice = { tenant: "t1", user: "alice" };
    const sid = await openSession(url, alice);

    expect(createSessionServer).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", userId: "alice" })
    );

    const res = await post(url, LIST, alice, sid);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: { tools: [] } });
  });

  it("rejects a different user or a different tenant presenting the same session id", async () => {
    const url = await start();
    const sid = await openSession(url, { tenant: "t1", user: "alice" });

    const otherUser = await post(url, LIST, { tenant: "t1", user: "mallory" }, sid);
    const otherTenant = await post(url, LIST, { tenant: "t2", user: "alice" }, sid);

    expect(otherUser.status).toBe(403);
    expect(await otherUser.json()).toEqual({
      error: "Session belongs to a different caller",
    });
    expect(otherTenant.status).toBe(403);
  });
});
