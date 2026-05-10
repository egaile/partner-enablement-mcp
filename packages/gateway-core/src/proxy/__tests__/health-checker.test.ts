import { describe, it, expect, vi, afterEach } from "vitest";
import {
  HealthChecker,
  type AlertSink,
} from "../index.js";

function createMockConnectionManager(
  connections: Array<{
    serverId: string;
    serverName: string;
    listToolsResult?: unknown;
    listToolsError?: Error;
  }>
) {
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
  } as never;
}

function createMockAlertSink(): AlertSink & {
  fireServerError: ReturnType<typeof vi.fn>;
} {
  return {
    fireInjection: vi.fn().mockResolvedValue(undefined),
    fireDrift: vi.fn().mockResolvedValue(undefined),
    firePolicyViolation: vi.fn().mockResolvedValue(undefined),
    fireRateLimit: vi.fn().mockResolvedValue(undefined),
    fireServerError: vi.fn().mockResolvedValue(undefined),
  };
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
    const sink = createMockAlertSink();
    checker = new HealthChecker({
      connectionManager: cm,
      alertSink: sink,
      tenantId: "tenant1",
    });

    await (checker as unknown as { checkAll(): Promise<void> }).checkAll();

    const status = checker.getStatus("s1");
    expect(status).toBeDefined();
    expect(status!.status).toBe("healthy");
    expect(status!.consecutiveFailures).toBe(0);
    expect(status!.latencyMs).toBeTypeOf("number");
  });

  it("marks failed servers as degraded", async () => {
    const cm = createMockConnectionManager([
      {
        serverId: "s1",
        serverName: "bad-server",
        listToolsError: new Error("timeout"),
      },
    ]);
    const sink = createMockAlertSink();
    checker = new HealthChecker({
      connectionManager: cm,
      alertSink: sink,
      tenantId: "tenant1",
    });

    await (checker as unknown as { checkAll(): Promise<void> }).checkAll();

    const status = checker.getStatus("s1");
    expect(status!.status).toBe("degraded");
    expect(status!.consecutiveFailures).toBe(1);
    expect(status!.latencyMs).toBeNull();
  });

  it("marks unreachable after threshold failures and fires alert", async () => {
    const cm = createMockConnectionManager([
      {
        serverId: "s1",
        serverName: "dead-server",
        listToolsError: new Error("refused"),
      },
    ]);
    const sink = createMockAlertSink();
    checker = new HealthChecker({
      connectionManager: cm,
      alertSink: sink,
      tenantId: "tenant1",
    });

    await (checker as unknown as { checkAll(): Promise<void> }).checkAll();
    await (checker as unknown as { checkAll(): Promise<void> }).checkAll();
    await (checker as unknown as { checkAll(): Promise<void> }).checkAll();

    const status = checker.getStatus("s1");
    expect(status!.status).toBe("unreachable");
    expect(status!.consecutiveFailures).toBe(3);
    expect(sink.fireServerError).toHaveBeenCalledTimes(1);
    expect(sink.fireServerError).toHaveBeenCalledWith(
      "tenant1",
      expect.objectContaining({
        serverId: "s1",
        serverName: "dead-server",
        errorType: "health_check_failure",
      })
    );
  });

  it("resets failures on successful check", async () => {
    const listTools = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ tools: [] });

    const cm = {
      getAllConnections: () => [
        {
          client: { listTools },
          serverId: "s1",
          serverName: "flaky",
          tools: new Map(),
        },
      ],
    } as never;

    const sink = createMockAlertSink();
    checker = new HealthChecker({
      connectionManager: cm,
      alertSink: sink,
      tenantId: "tenant1",
    });

    await (checker as unknown as { checkAll(): Promise<void> }).checkAll();
    expect(checker.getStatus("s1")!.consecutiveFailures).toBe(1);

    await (checker as unknown as { checkAll(): Promise<void> }).checkAll();
    expect(checker.getStatus("s1")!.status).toBe("healthy");
    expect(checker.getStatus("s1")!.consecutiveFailures).toBe(0);
  });

  it("getAllStatuses returns all tracked servers", async () => {
    const cm = createMockConnectionManager([
      { serverId: "s1", serverName: "server1" },
      { serverId: "s2", serverName: "server2" },
    ]);
    const sink = createMockAlertSink();
    checker = new HealthChecker({
      connectionManager: cm,
      alertSink: sink,
      tenantId: "tenant1",
    });

    await (checker as unknown as { checkAll(): Promise<void> }).checkAll();

    const statuses = checker.getAllStatuses();
    expect(statuses).toHaveLength(2);
  });

  it("start and stop are idempotent", () => {
    const cm = createMockConnectionManager([]);
    const sink = createMockAlertSink();
    checker = new HealthChecker({
      connectionManager: cm,
      alertSink: sink,
      tenantId: "tenant1",
    });

    checker.start();
    checker.start();
    checker.stop();
    checker.stop();
  });
});
