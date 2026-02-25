import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolSnapshotRecord } from "../../db/queries/snapshots.js";

// ---------------------------------------------------------------------------
// Mocks — must come before importing the module under test
// ---------------------------------------------------------------------------

const mockGetSnapshot = vi.fn<
  (tenantId: string, serverId: string, toolName: string) => Promise<ToolSnapshotRecord | null>
>();
const mockUpsertSnapshot = vi.fn<
  (
    tenantId: string,
    serverId: string,
    toolName: string,
    definitionHash: string,
    definition: Record<string, unknown>
  ) => Promise<ToolSnapshotRecord>
>();

vi.mock("../../db/queries/snapshots.js", () => ({
  getSnapshot: (...args: unknown[]) =>
    mockGetSnapshot(args[0] as string, args[1] as string, args[2] as string),
  upsertSnapshot: (...args: unknown[]) =>
    mockUpsertSnapshot(
      args[0] as string,
      args[1] as string,
      args[2] as string,
      args[3] as string,
      args[4] as Record<string, unknown>
    ),
}));

// Now import the module under test
const { hashToolDefinition, checkToolDrift } = await import("../tool-snapshot.js");
type ToolDefinition = import("../tool-snapshot.js").ToolDefinition;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT = "tenant-abc";
const SERVER = "server-xyz";

// ---------------------------------------------------------------------------
// hashToolDefinition
// ---------------------------------------------------------------------------

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

    const hash1 = hashToolDefinition(def);
    const hash2 = hashToolDefinition(def);

    expect(hash1).toBe(hash2);
    // SHA-256 produces a 64-character hex string
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("identical definitions produce the same hash", () => {
    const def1: ToolDefinition = {
      name: "list_items",
      description: "Lists items",
      inputSchema: { type: "object", properties: {} },
    };
    const def2: ToolDefinition = {
      name: "list_items",
      description: "Lists items",
      inputSchema: { type: "object", properties: {} },
    };

    expect(hashToolDefinition(def1)).toBe(hashToolDefinition(def2));
  });

  it("different descriptions produce different hashes", () => {
    const def1: ToolDefinition = { name: "tool", description: "Version 1" };
    const def2: ToolDefinition = { name: "tool", description: "Version 2" };

    expect(hashToolDefinition(def1)).not.toBe(hashToolDefinition(def2));
  });

  it("different names produce different hashes", () => {
    const def1: ToolDefinition = { name: "tool_a", description: "Same" };
    const def2: ToolDefinition = { name: "tool_b", description: "Same" };

    expect(hashToolDefinition(def1)).not.toBe(hashToolDefinition(def2));
  });

  it("different input schemas produce different hashes", () => {
    const def1: ToolDefinition = {
      name: "tool",
      inputSchema: { type: "object", properties: { a: { type: "string" } } },
    };
    const def2: ToolDefinition = {
      name: "tool",
      inputSchema: { type: "object", properties: { b: { type: "number" } } },
    };

    expect(hashToolDefinition(def1)).not.toBe(hashToolDefinition(def2));
  });

  it("treats missing description as empty string (consistent hash)", () => {
    const def1: ToolDefinition = { name: "tool" };
    const def2: ToolDefinition = { name: "tool", description: "" };

    expect(hashToolDefinition(def1)).toBe(hashToolDefinition(def2));
  });

  it("treats missing inputSchema as empty object (consistent hash)", () => {
    const def1: ToolDefinition = { name: "tool" };
    const def2: ToolDefinition = { name: "tool", inputSchema: {} };

    expect(hashToolDefinition(def1)).toBe(hashToolDefinition(def2));
  });
});

// ---------------------------------------------------------------------------
// checkToolDrift
// ---------------------------------------------------------------------------

describe("checkToolDrift", () => {
  beforeEach(() => {
    mockGetSnapshot.mockReset();
    mockUpsertSnapshot.mockReset();
    mockUpsertSnapshot.mockResolvedValue({} as ToolSnapshotRecord);
  });

  // ---- New tool (no existing snapshot) ----

  it("auto-approves a new tool when no snapshot exists", async () => {
    mockGetSnapshot.mockResolvedValue(null);

    const tool: ToolDefinition = {
      name: "new_tool",
      description: "A brand new tool",
      inputSchema: { type: "object", properties: { q: { type: "string" } } },
    };

    const result = await checkToolDrift(TENANT, SERVER, tool);

    expect(result.drifted).toBe(false);
    expect(result.severity).toBeNull();
    expect(result.changes).toHaveLength(0);
    expect(result.currentHash).toBe(result.approvedHash);

    // Should have upserted the snapshot
    expect(mockUpsertSnapshot).toHaveBeenCalledOnce();
    expect(mockUpsertSnapshot).toHaveBeenCalledWith(
      TENANT,
      SERVER,
      "new_tool",
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.objectContaining({ name: "new_tool" })
    );
  });

  // ---- Matching hash (no drift) ----

  it("reports no drift when the hash matches", async () => {
    const tool: ToolDefinition = {
      name: "stable_tool",
      description: "Unchanged",
      inputSchema: { type: "object", properties: { x: { type: "number" } } },
    };

    const currentHash = hashToolDefinition(tool);

    mockGetSnapshot.mockResolvedValue({
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

    const result = await checkToolDrift(TENANT, SERVER, tool);

    expect(result.drifted).toBe(false);
    expect(result.severity).toBeNull();
    expect(result.changes).toHaveLength(0);
    expect(result.currentHash).toBe(currentHash);
    expect(result.approvedHash).toBe(currentHash);
    // Should NOT upsert
    expect(mockUpsertSnapshot).not.toHaveBeenCalled();
  });

  // ---- Description-only change (cosmetic severity) ----

  it("detects description-only change as cosmetic severity", async () => {
    const oldDef = {
      name: "my_tool",
      description: "Old description",
      inputSchema: { type: "object", properties: { a: { type: "string" } } },
    };
    const newTool: ToolDefinition = {
      name: "my_tool",
      description: "New description",
      inputSchema: { type: "object", properties: { a: { type: "string" } } },
    };

    const oldHash = hashToolDefinition(oldDef);

    mockGetSnapshot.mockResolvedValue({
      id: "snap-1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "my_tool",
      definitionHash: oldHash,
      definition: oldDef,
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await checkToolDrift(TENANT, SERVER, newTool);

    expect(result.drifted).toBe(true);
    expect(result.severity).toBe("cosmetic");
    expect(result.changes).toContain("description changed");
    expect(result.currentHash).not.toBe(oldHash);
    expect(result.approvedHash).toBe(oldHash);
  });

  // ---- Added parameter (critical severity) ----

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

    const oldHash = hashToolDefinition(oldDef);

    mockGetSnapshot.mockResolvedValue({
      id: "snap-1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "my_tool",
      definitionHash: oldHash,
      definition: oldDef,
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await checkToolDrift(TENANT, SERVER, newTool);

    expect(result.drifted).toBe(true);
    expect(result.severity).toBe("critical");
    expect(result.changes).toContain("parameter added: newParam");
  });

  // ---- Removed parameter (functional severity) ----

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

    const oldHash = hashToolDefinition(oldDef);

    mockGetSnapshot.mockResolvedValue({
      id: "snap-1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "my_tool",
      definitionHash: oldHash,
      definition: oldDef,
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await checkToolDrift(TENANT, SERVER, newTool);

    expect(result.drifted).toBe(true);
    expect(result.severity).toBe("functional");
    expect(result.changes).toContain("parameter removed: removeMe");
  });

  // ---- Both added and removed (critical wins) ----

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

    const oldHash = hashToolDefinition(oldDef);

    mockGetSnapshot.mockResolvedValue({
      id: "snap-1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "my_tool",
      definitionHash: oldHash,
      definition: oldDef,
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await checkToolDrift(TENANT, SERVER, newTool);

    expect(result.drifted).toBe(true);
    expect(result.severity).toBe("critical"); // added param takes precedence
    expect(result.changes).toContain("parameter added: new_param");
    expect(result.changes).toContain("parameter removed: old_param");
  });

  // ---- Input schema added ----

  it("detects input schema added as functional severity", async () => {
    const oldDef = {
      name: "my_tool",
      description: "Same",
      // no inputSchema (or no properties)
    };
    const newTool: ToolDefinition = {
      name: "my_tool",
      description: "Same",
      inputSchema: {
        type: "object",
        properties: { q: { type: "string" } },
      },
    };

    const oldHash = hashToolDefinition(oldDef);

    mockGetSnapshot.mockResolvedValue({
      id: "snap-1",
      tenantId: TENANT,
      serverId: SERVER,
      toolName: "my_tool",
      definitionHash: oldHash,
      definition: oldDef,
      approved: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    const result = await checkToolDrift(TENANT, SERVER, newTool);

    expect(result.drifted).toBe(true);
    // The old schema is {} (no properties key), new has properties.
    // Code checks: !oldProps && newProps → "input schema added" → functional
    expect(result.changes).toContain("input schema added");
    expect(result.severity).toBe("functional");
  });
});
