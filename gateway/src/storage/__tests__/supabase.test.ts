import { describe, it, expect, vi } from "vitest";
import { StorageError } from "@mcpshield/gateway-core/storage";

// ---------------------------------------------------------------------------
// Mock the underlying db/queries modules so the smoke test runs without
// hitting Supabase. The point is to verify the StorageBackend interface
// surface, not the underlying queries (which have their own coverage in
// integration tests against a real Supabase instance).
// ---------------------------------------------------------------------------

vi.mock("../../db/queries/api-keys.js", () => ({
  getApiKeyByHash: vi.fn().mockResolvedValue(null),
  updateLastUsed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../db/queries/audit.js", () => ({
  insertAuditEntries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../db/queries/policies.js", () => ({
  getPoliciesForTenant: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../db/queries/servers.js", () => ({
  getEnabledServersForTenant: vi.fn().mockResolvedValue([]),
  getServerById: vi.fn().mockResolvedValue(null),
  updateServerOAuthTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../db/queries/snapshots.js", () => ({
  getSnapshot: vi.fn().mockResolvedValue(null),
  upsertSnapshot: vi.fn().mockResolvedValue({
    id: "s1",
    tenantId: "t1",
    serverId: "srv1",
    toolName: "tool",
    definitionHash: "abc",
    definition: {},
    approved: true,
    createdAt: "2026-05-10T00:00:00Z",
    updatedAt: "2026-05-10T00:00:00Z",
  }),
}));

vi.mock("../../db/queries/tenants.js", () => ({
  getTenantById: vi.fn().mockResolvedValue({
    id: "t1",
    name: "Acme",
    slug: "acme",
    settings: { industry: "saas" },
    plan: "pro",
    createdAt: "2026-05-10T00:00:00Z",
    updatedAt: "2026-05-10T00:00:00Z",
  }),
}));

const { SupabaseStorageBackend } = await import("../supabase.js");

describe("SupabaseStorageBackend", () => {
  it("implements StorageBackend (init/close are no-ops)", async () => {
    const sb = new SupabaseStorageBackend();
    await expect(sb.init()).resolves.toBeUndefined();
    await expect(sb.close()).resolves.toBeUndefined();
  });

  it("tenants.getById maps the underlying query result", async () => {
    const sb = new SupabaseStorageBackend();
    const t = await sb.tenants.getById("t1");
    expect(t?.id).toBe("t1");
    expect(t?.settings).toEqual({ industry: "saas" });
  });

  it("tenants.getOrCreateDefault throws (cloud requires explicit tenant)", async () => {
    const sb = new SupabaseStorageBackend();
    await expect(sb.tenants.getOrCreateDefault()).rejects.toThrow(StorageError);
  });

  it("policies.upsert throws (cloud uses dashboard CRUD, not config-as-code)", async () => {
    const sb = new SupabaseStorageBackend();
    await expect(
      sb.policies.upsert({
        tenantId: "t1",
        name: "test",
        conditions: { tools: ["*"] },
        action: "allow",
      })
    ).rejects.toThrow(/not supported/);
  });

  it("policies.replaceFromConfig throws", async () => {
    const sb = new SupabaseStorageBackend();
    await expect(
      sb.policies.replaceFromConfig("t1", [])
    ).rejects.toThrow(/not supported/);
  });

  it("servers.upsert throws", async () => {
    const sb = new SupabaseStorageBackend();
    await expect(
      sb.servers.upsert({
        tenantId: "t1",
        name: "atlassian",
        transport: "http",
        url: "https://example.com",
      })
    ).rejects.toThrow(/not supported/);
  });

  it("audit.append no-ops on empty batch", async () => {
    const sb = new SupabaseStorageBackend();
    await expect(sb.audit.append([])).resolves.toBeUndefined();
  });

  it("snapshots.upsert maps interface input to positional query args", async () => {
    const sb = new SupabaseStorageBackend();
    const result = await sb.snapshots.upsert({
      tenantId: "t1",
      serverId: "srv1",
      toolName: "tool",
      definitionHash: "abc",
      definition: { name: "tool" },
    });
    expect(result.toolName).toBe("tool");
    expect(result.definitionHash).toBe("abc");
  });

  it("apiKeys.findByHash returns null for unknown hash (mocked)", async () => {
    const sb = new SupabaseStorageBackend();
    const k = await sb.apiKeys.findByHash("nope");
    expect(k).toBeNull();
  });
});
