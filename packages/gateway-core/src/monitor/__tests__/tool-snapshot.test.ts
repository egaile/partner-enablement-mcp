import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DriftDetector,
  hashToolDefinition,
  type SnapshotsPort,
  type ToolDefinition,
} from "../tool-snapshot.js";
import type {
  SnapshotUpsertInput,
  ToolSnapshotRecord,
} from "../../storage/types.js";

const TENANT = "tenant-abc";
const SERVER = "server-xyz";

function makeFake(): {
  port: SnapshotsPort;
  get: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const get = vi.fn<
    (
      tenantId: string,
      serverId: string,
      toolName: string
    ) => Promise<ToolSnapshotRecord | null>
  >();
  const upsert = vi.fn<(input: SnapshotUpsertInput) => Promise<ToolSnapshotRecord>>();
  upsert.mockResolvedValue({
    id: "fake",
    tenantId: TENANT,
    serverId: SERVER,
    toolName: "fake",
    definitionHash: "fake",
    definition: {},
    approved: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  });
  return {
    port: {
      get: (t: string, s: string, n: string) => get(t, s, n),
      upsert: (input: SnapshotUpsertInput) => upsert(input),
    },
    get,
    upsert,
  };
}

describe("hashToolDefinition", () => {
  it("produces a consistent SHA-256 hex string", () => {
    const def: ToolDefinition = {
      name: "get_user",
      description: "Gets a user by ID",
      inputSchema: {
        type: "object",
        properties: { userId: { type: "string" } },
      },
    };
    const h1 = hashToolDefinition(def);
    const h2 = hashToolDefinition(def);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("identical definitions produce the same hash", () => {
    const a: ToolDefinition = {
      name: "list_items",
      description: "Lists items",
      inputSchema: { type: "object", properties: {} },
    };
    const b: ToolDefinition = {
      name: "list_items",
      description: "Lists items",
      inputSchema: { type: "object", properties: {} },
    };
    expect(hashToolDefinition(a)).toBe(hashToolDefinition(b));
  });

  it("different descriptions produce different hashes", () => {
    expect(
      hashToolDefinition({ name: "tool", description: "Version 1" })
    ).not.toBe(hashToolDefinition({ name: "tool", description: "Version 2" }));
  });

  it("different names produce different hashes", () => {
    expect(
      hashToolDefinition({ name: "tool_a", description: "Same" })
    ).not.toBe(hashToolDefinition({ name: "tool_b", description: "Same" }));
  });

  it("different input schemas produce different hashes", () => {
    const a: ToolDefinition = {
      name: "tool",
      inputSchema: { type: "object", properties: { a: { type: "string" } } },
    };
    const b: ToolDefinition = {
      name: "tool",
      inputSchema: { type: "object", properties: { b: { type: "number" } } },
    };
    expect(hashToolDefinition(a)).not.toBe(hashToolDefinition(b));
  });

  it("treats missing description as empty string", () => {
    expect(hashToolDefinition({ name: "tool" })).toBe(
      hashToolDefinition({ name: "tool", description: "" })
    );
  });

  it("treats missing inputSchema as empty object", () => {
    expect(hashToolDefinition({ name: "tool" })).toBe(
      hashToolDefinition({ name: "tool", inputSchema: {} })
    );
  });
});

describe("DriftDetector", () => {
  let fake: ReturnType<typeof makeFake>;
  let detector: DriftDetector;

  beforeEach(() => {
    fake = makeFake();
    detector = new DriftDetector({ snapshots: fake.port });
  });

  it("auto-approves a new tool when no snapshot exists", async () => {
    fake.get.mockResolvedValue(null);

    const tool: ToolDefinition = {
      name: "new_tool",
      description: "A brand new tool",
      inputSchema: { type: "object", properties: { q: { type: "string" } } },
    };
    const result = await detector.check(TENANT, SERVER, tool);

    expect(result.drifted).toBe(false);
    expect(result.severity).toBeNull();
    expect(result.changes).toHaveLength(0);
    expect(result.currentHash).toBe(result.approvedHash);
    expect(fake.upsert).toHaveBeenCalledOnce();
    expect(fake.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        serverId: SERVER,
        toolName: "new_tool",
        definitionHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        definition: expect.objectContaining({ name: "new_tool" }),
      })
    );
  });

  it("reports no drift when the hash matches", async () => {
    const tool: ToolDefinition = {
      name: "stable_tool",
      description: "Unchanged",
      inputSchema: { type: "object", properties: { x: { type: "number" } } },
    };
    const currentHash = hashToolDefinition(tool);
    fake.get.mockResolvedValue({
      id: "snap-1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "stable_tool",
      definitionHash: currentHash,
      definition: {
        name: "stable_tool",
        description: "Unchanged",
        inputSchema: { type: "object", properties: { x: { type: "number" } } },
      },
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await detector.check(TENANT, SERVER, tool);
    expect(result.drifted).toBe(false);
    expect(result.severity).toBeNull();
    expect(result.changes).toHaveLength(0);
    expect(fake.upsert).not.toHaveBeenCalled();
  });

  it("detects description-only change as cosmetic severity", async () => {
    const oldDef = {
      name: "my_tool",
      description: "Old description",
      inputSchema: { type: "object", properties: { a: { type: "string" } } },
    };
    const newTool: ToolDefinition = {
      ...oldDef,
      description: "New description",
    };
    fake.get.mockResolvedValue({
      id: "s1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "my_tool",
      definitionHash: hashToolDefinition(oldDef),
      definition: oldDef,
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await detector.check(TENANT, SERVER, newTool);
    expect(result.drifted).toBe(true);
    expect(result.severity).toBe("cosmetic");
    expect(result.changes).toContain("description changed");
  });

  it("detects added parameter as critical severity", async () => {
    const oldDef = {
      name: "my_tool",
      description: "Same description",
      inputSchema: {
        type: "object",
        properties: { existing: { type: "string" } },
      },
    };
    const newTool: ToolDefinition = {
      name: "my_tool",
      description: "Same description",
      inputSchema: {
        type: "object",
        properties: {
          existing: { type: "string" },
          newParam: { type: "string" },
        },
      },
    };
    fake.get.mockResolvedValue({
      id: "s1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "my_tool",
      definitionHash: hashToolDefinition(oldDef),
      definition: oldDef,
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await detector.check(TENANT, SERVER, newTool);
    expect(result.drifted).toBe(true);
    expect(result.severity).toBe("critical");
    expect(result.changes).toContain("parameter added: newParam");
  });

  it("detects removed parameter as functional severity", async () => {
    const oldDef = {
      name: "my_tool",
      description: "Same description",
      inputSchema: {
        type: "object",
        properties: {
          keepMe: { type: "string" },
          removeMe: { type: "number" },
        },
      },
    };
    const newTool: ToolDefinition = {
      name: "my_tool",
      description: "Same description",
      inputSchema: {
        type: "object",
        properties: { keepMe: { type: "string" } },
      },
    };
    fake.get.mockResolvedValue({
      id: "s1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "my_tool",
      definitionHash: hashToolDefinition(oldDef),
      definition: oldDef,
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await detector.check(TENANT, SERVER, newTool);
    expect(result.drifted).toBe(true);
    expect(result.severity).toBe("functional");
    expect(result.changes).toContain("parameter removed: removeMe");
  });

  it("classifies as critical when both added and removed parameters", async () => {
    const oldDef = {
      name: "my_tool",
      description: "Same",
      inputSchema: {
        type: "object",
        properties: { old_param: { type: "string" } },
      },
    };
    const newTool: ToolDefinition = {
      name: "my_tool",
      description: "Same",
      inputSchema: {
        type: "object",
        properties: { new_param: { type: "string" } },
      },
    };
    fake.get.mockResolvedValue({
      id: "s1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "my_tool",
      definitionHash: hashToolDefinition(oldDef),
      definition: oldDef,
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await detector.check(TENANT, SERVER, newTool);
    expect(result.drifted).toBe(true);
    expect(result.severity).toBe("critical");
    expect(result.changes).toContain("parameter added: new_param");
    expect(result.changes).toContain("parameter removed: old_param");
  });

  it("detects input schema added as functional severity", async () => {
    const oldDef = { name: "my_tool", description: "Same" };
    const newTool: ToolDefinition = {
      name: "my_tool",
      description: "Same",
      inputSchema: {
        type: "object",
        properties: { q: { type: "string" } },
      },
    };
    fake.get.mockResolvedValue({
      id: "s1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "my_tool",
      definitionHash: hashToolDefinition(oldDef),
      definition: oldDef,
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await detector.check(TENANT, SERVER, newTool);
    expect(result.drifted).toBe(true);
    expect(result.changes).toContain("input schema added");
    expect(result.severity).toBe("functional");
  });
});
