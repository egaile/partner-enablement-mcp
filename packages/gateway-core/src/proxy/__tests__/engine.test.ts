import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { GatewayProxyEngine } from "../engine.js";
import type { TenantContext } from "../types.js";

const ENGINE_CTX: TenantContext = {
  tenantId: "t1",
  tenantName: "default",
  userId: "engine-user",
  userRole: "owner",
};
const SESSION_CTX: TenantContext = {
  tenantId: "t1",
  tenantName: "default",
  userId: "session-user",
  userRole: "member",
};

function buildEngine() {
  const engine = new GatewayProxyEngine({
    storage: {} as never,
    policyEngine: { clearCache: vi.fn() } as never,
    driftDetector: {} as never,
    scanner: {} as never,
    auditRecorder: { record: vi.fn() },
    healthCheckIntervalMs: 0,
  });
  const intercept = vi.fn(async () => ({
    allowed: true,
    response: { content: [{ type: "text", text: "ok" }] },
  }));
  // Reach past the private fields so the test only exercises how the
  // session server picks its tenant context.
  (engine as unknown as { interceptor: { intercept: typeof intercept } }).interceptor.intercept =
    intercept;
  vi.spyOn(engine.getConnectionManager(), "resolveNamespacedTool").mockReturnValue({
    connection: { serverName: "srv" },
    toolName: "doThing",
  } as never);
  return { engine, intercept };
}

const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

async function callTool(engine: GatewayProxyEngine, ctx?: TenantContext) {
  const server = engine.createSessionServer(ctx);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  clients.push(client);
  await client.connect(clientSide);
  return client.callTool({ name: "srv__doThing", arguments: { x: 1 } });
}

describe("GatewayProxyEngine.createSessionServer", () => {
  it("attributes calls to the session's caller, not the engine-wide context", async () => {
    const { engine, intercept } = buildEngine();
    engine.setTenantContext(ENGINE_CTX);

    const result = await callTool(engine, SESSION_CTX);

    expect(result.isError).toBeFalsy();
    expect(intercept).toHaveBeenCalledWith(
      SESSION_CTX,
      expect.anything(),
      "doThing",
      { x: 1 }
    );
  });

  it("falls back to the engine-wide context when no session context is passed", async () => {
    const { engine, intercept } = buildEngine();
    engine.setTenantContext(ENGINE_CTX);

    await callTool(engine);

    expect(intercept).toHaveBeenCalledWith(
      ENGINE_CTX,
      expect.anything(),
      "doThing",
      { x: 1 }
    );
  });

  it("returns an error when neither context is set", async () => {
    const { engine, intercept } = buildEngine();

    const result = await callTool(engine);

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("no tenant context");
    expect(intercept).not.toHaveBeenCalled();
  });
});

describe("GatewayProxyEngine allowStdio", () => {
  const stdioRecord = {
    id: "s1",
    tenantId: "t1",
    name: "legacy-stdio",
    transport: "stdio",
    command: "node",
    args: [],
    enabled: true,
  };

  function engineWith(allowStdio: boolean | undefined) {
    const fireServerError = vi.fn(async () => {});
    const engine = new GatewayProxyEngine({
      storage: {
        servers: { listEnabledForTenant: vi.fn(async () => [stdioRecord]) },
      } as never,
      policyEngine: { clearCache: vi.fn() } as never,
      driftDetector: {} as never,
      scanner: {} as never,
      auditRecorder: { record: vi.fn() },
      alertSink: { fireServerError } as never,
      healthCheckIntervalMs: 0,
      allowStdio,
    });
    return { engine, fireServerError };
  }

  it("passes allowStdio:false through to the connection manager", async () => {
    const { engine } = engineWith(false);
    await expect(
      engine.getConnectionManager().connect(stdioRecord as never)
    ).rejects.toThrow(/stdio.*disabled/);
  });

  it("skips legacy stdio records without spawning or alerting", async () => {
    const { engine, fireServerError } = engineWith(false);
    const connect = vi.spyOn(engine.getConnectionManager(), "connect");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await engine.connectDownstreamServers("t1");
    warn.mockRestore();
    log.mockRestore();
    expect(connect).not.toHaveBeenCalled();
    expect(fireServerError).not.toHaveBeenCalled();
  });
});
