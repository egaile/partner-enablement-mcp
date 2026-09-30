import { describe, expect, it, vi } from "vitest";

// The cloud engine is a thin wrapper around the core engine. These tests pin
// the two options that matter for tenant isolation: stdio is off, and each
// MCP session keeps its own caller context.
const coreOptions: Record<string, unknown>[] = [];
const coreCreateSessionServer = vi.fn((ctx?: unknown) => ({ ctx }));

vi.mock("@mcpshield/gateway-core/proxy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mcpshield/gateway-core/proxy")>();
  return {
    ...actual,
    GatewayProxyEngine: class {
      constructor(options: Record<string, unknown>) {
        coreOptions.push(options);
      }
      createSessionServer = coreCreateSessionServer;
    },
  };
});
vi.mock("../../db/client.js", () => ({ getSupabaseClient: vi.fn() }));

const { GatewayProxyEngine } = await import("../engine.js");

describe("cloud GatewayProxyEngine", () => {
  it("turns stdio off in the core engine", () => {
    new GatewayProxyEngine();
    expect(coreOptions.at(-1)?.allowStdio).toBe(false);
  });

  it("passes the session's caller context through to the core engine", () => {
    const engine = new GatewayProxyEngine();
    const ctx = {
      tenantId: "t1",
      tenantName: "Demo",
      userId: "user_1",
      userRole: "member",
    };
    engine.createSessionServer(ctx);
    expect(coreCreateSessionServer).toHaveBeenLastCalledWith(ctx);
  });
});
