import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { IncomingHttpHeaders } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  AuthError,
  type AuthProvider,
  type GatewayProxyEngine,
  type Principal,
} from "@mcpshield/gateway-core";
import { startHttpServer, type RunningServer } from "../http-server.js";

const createSessionServer = vi.fn((_ctx?: unknown) => {
  const server = new Server(
    { name: "test-gateway", version: "0.0.0" },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
  return server;
});
const engine = { createSessionServer } as unknown as GatewayProxyEngine;

// Keys: "alice" and "bob" are valid, "revoked" is a 403, "broken" throws a
// plain Error, anything else (or no header) is "no credentials".
const authProvider: AuthProvider = {
  async authenticate(headers: IncomingHttpHeaders): Promise<Principal | null> {
    const key = headers.authorization?.replace(/^Bearer /, "");
    if (key === "revoked") throw new AuthError("API key revoked", 403);
    if (key === "broken") throw new Error("storage offline");
    if (key !== "alice" && key !== "bob") return null;
    return {
      tenantId: "default",
      tenantName: "Default",
      userId: `apikey:${key}`,
      role: "member",
      plan: "self_hosted",
    };
  },
};

let running: RunningServer | undefined;
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(async () => {
  vi.restoreAllMocks();
  createSessionServer.mockClear();
  await running?.close();
  running = undefined;
});

async function start(withAuth: boolean): Promise<string> {
  running = await startHttpServer({
    engine,
    authProvider: withAuth ? authProvider : undefined,
    host: "127.0.0.1",
    port: 0,
  });
  const { port } = running.httpServer.address() as AddressInfo;
  return `http://127.0.0.1:${port}/mcp`;
}

function post(url: string, body: unknown, key?: string, sessionId?: string) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...(sessionId
        ? { "mcp-session-id": sessionId, "mcp-protocol-version": "2025-03-26" }
        : {}),
    },
    body: JSON.stringify(body),
  });
}

const INIT = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
  },
};
const LIST = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };

describe("self-hosted /mcp auth and session ownership", () => {
  it("uses AuthError.statusCode, and falls back to 401 for other failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const url = await start(true);

    const revoked = await post(url, INIT, "revoked");
    const broken = await post(url, INIT, "broken");
    const missing = await post(url, INIT);

    expect(revoked.status).toBe(403);
    expect(await revoked.json()).toEqual({ error: "API key revoked" });
    expect(broken.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(createSessionServer).not.toHaveBeenCalled();
  });

  it("binds the session to the key's principal and refuses other keys", async () => {
    const url = await start(true);

    const init = await post(url, INIT, "alice");
    const sid = init.headers.get("mcp-session-id")!;
    expect(init.status).toBe(200);
    expect(createSessionServer).toHaveBeenCalledWith({
      tenantId: "default",
      tenantName: "Default",
      userId: "apikey:alice",
      userRole: "member",
      plan: "self_hosted",
    });

    const owner = await post(url, LIST, "alice", sid);
    const other = await post(url, LIST, "bob", sid);

    expect(owner.status).toBe(200);
    expect(other.status).toBe(403);
    expect(await other.json()).toEqual({
      error: "Session belongs to a different caller",
    });
  });

  it("without an auth provider, sessions stay usable and get no session context", async () => {
    const url = await start(false);

    const init = await post(url, INIT);
    const sid = init.headers.get("mcp-session-id")!;
    const next = await post(url, LIST, undefined, sid);

    expect(createSessionServer).toHaveBeenCalledWith(undefined);
    expect(next.status).toBe(200);
  });
});
