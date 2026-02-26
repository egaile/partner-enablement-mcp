import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HealthChecker, type HealthStatus } from "../health-checker.js";

// Mock connection manager
function createMockConnectionManager(connections: Array<{
  serverId: string;
  serverName: string;
  listToolsResult?: unknown;
  listToolsError?: Error;
}>) {
  const conns = connections.map((c) => ({
    client: {
      listTools: c.listToolsError
        ? vi.fn().mockRejectedValue(c.listToolsError)
        : vi.fn().mockResolvedValue(c.listToolsResult ?? { tools: [] }),
    },
    serverId: c.serverId,
    serverName: c.serverName,
    tools: new Map(),
  }));

  return {
    getAllConnections: () => conns,
    getConnection: (id: string) => conns.find((c) => c.serverId === id),
  } as any;
}

function createMockAlertEngine() {
  return {
    fireServerError: vi.fn().mockResolvedValue({}),
    fireInjectionAlert: vi.fn().mockResolvedValue({}),
    fireDriftAlert: vi.fn().mockResolvedValue({}),
    firePolicyViolation: vi.fn().mockResolvedValue({}),
  } as any;
}

describe("HealthChecker", () => {
  let checker: HealthChecker;

  afterEach(() => {
    checker?.stop();
  });

  it("marks healthy servers correctly", async () => {
    const cm = createMockConnectionManager([
      { serverId: "s1", serverName: "test-server" },
    ]);
    const ae = createMockAlertEngine();
    checker = new HealthChecker(cm, ae, "tenant1", 60_000);

    // Manually trigger check
    await (checker as any).checkAll();

    const status = checker.getStatus("s1");
    expect(status).toBeDefined();
    expect(status!.status).toBe("healthy");
    expect(status!.consecutiveFailures).toBe(0);
    expect(status!.latencyMs).toBeTypeOf("number");
  });

  it("marks failed servers as degraded", async () => {
    const cm = createMockConnectionManager([
      { serverId: "s1", serverName: "bad-server", listToolsError: new Error("timeout") },
    ]);
    const ae = createMockAlertEngine();
    checker = new HealthChecker(cm, ae, "tenant1", 60_000);

    await (checker as any).checkAll();

    const status = checker.getStatus("s1");
    expect(status!.status).toBe("degraded");
    expect(status!.consecutiveFailures).toBe(1);
    expect(status!.latencyMs).toBeNull();
  });

  it("marks unreachable after threshold failures and fires alert", async () => {
    const cm = createMockConnectionManager([
      { serverId: "s1", serverName: "dead-server", listToolsError: new Error("refused") },
    ]);
    const ae = createMockAlertEngine();
    checker = new HealthChecker(cm, ae, "tenant1", 60_000);

    // Check 3 times (threshold)
    await (checker as any).checkAll();
    await (checker as any).checkAll();
    await (checker as any).checkAll();

    const status = checker.getStatus("s1");
    expect(status!.status).toBe("unreachable");
    expect(status!.consecutiveFailures).toBe(3);
    expect(ae.fireServerError).toHaveBeenCalledTimes(1);
    expect(ae.fireServerError).toHaveBeenCalledWith("tenant1", expect.objectContaining({
      serverId: "s1",
      serverName: "dead-server",
      errorType: "health_check_failure",
    }));
  });

  it("resets failures on successful check", async () => {
    const listTools = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ tools: [] });

    const cm = {
      getAllConnections: () => [{
        client: { listTools },
        serverId: "s1",
        serverName: "flaky",
        tools: new Map(),
      }],
    } as any;

    const ae = createMockAlertEngine();
    checker = new HealthChecker(cm, ae, "tenant1", 60_000);

    await (checker as any).checkAll();
    expect(checker.getStatus("s1")!.consecutiveFailures).toBe(1);

    await (checker as any).checkAll();
    expect(checker.getStatus("s1")!.status).toBe("healthy");
    expect(checker.getStatus("s1")!.consecutiveFailures).toBe(0);
  });

  it("getAllStatuses returns all tracked servers", async () => {
    const cm = createMockConnectionManager([
      { serverId: "s1", serverName: "server1" },
      { serverId: "s2", serverName: "server2" },
    ]);
    const ae = createMockAlertEngine();
    checker = new HealthChecker(cm, ae, "tenant1", 60_000);

    await (checker as any).checkAll();

    const statuses = checker.getAllStatuses();
    expect(statuses).toHaveLength(2);
  });

  it("start and stop are idempotent", () => {
    const cm = createMockConnectionManager([]);
    const ae = createMockAlertEngine();
    checker = new HealthChecker(cm, ae, "tenant1", 60_000);

    checker.start();
    checker.start();
    checker.stop();
    checker.stop();
  });
});
