import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStorageBackend } from "../../storage/sqlite.js";
import {
  ApiKeyAuthProvider,
  generateApiKey,
  hashApiKey,
} from "../api-key-provider.js";
import { AuthError } from "../types.js";

describe("ApiKeyAuthProvider", () => {
  let storage: SqliteStorageBackend;
  let provider: ApiKeyAuthProvider;
  const TENANT_ID = "00000000-0000-0000-0000-000000000001";

  beforeEach(async () => {
    storage = new SqliteStorageBackend({
      path: ":memory:",
      defaultTenantId: TENANT_ID,
    });
    await storage.init();
    await storage.tenants.getOrCreateDefault();
    provider = new ApiKeyAuthProvider({ storage });
  });

  afterEach(async () => {
    await storage.close();
  });

  function seedKey(key: { key: string; keyHash: string; keyPrefix: string }): {
    id: string;
  } {
    // Direct insert because the OSS storage interface doesn't yet expose
    // an admin createApiKey method (lives in cloud-control-plane CRUD).
    // We're using SQLite directly via a private cast for test setup only.
    const sb = storage as unknown as {
      requireDb: () => {
        prepare: (sql: string) => {
          run: (...params: unknown[]) => unknown;
          get: (...params: unknown[]) => { id: string } | undefined;
        };
      };
    };
    const db = sb.requireDb();
    const id = "11111111-1111-1111-1111-111111111111";
    db.prepare(
      `INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, TENANT_ID, "test-key", key.keyHash, key.keyPrefix, "test-user");
    return { id };
  }

  it("returns null when no Authorization header is present", async () => {
    const principal = await provider.authenticate({});
    expect(principal).toBeNull();
  });

  it("returns null for Bearer token without mgw_ prefix", async () => {
    // Other auth types (Clerk JWT) should pass through to the next provider.
    const principal = await provider.authenticate({
      authorization: "Bearer eyJhbGc.someother.jwt",
    });
    expect(principal).toBeNull();
  });

  it("throws AuthError for an unknown mgw_ key", async () => {
    await expect(
      provider.authenticate({
        authorization: "Bearer mgw_0000000000000000000000000000000000",
      })
    ).rejects.toThrow(AuthError);
  });

  it("authenticates a valid key and returns a Principal", async () => {
    const generated = generateApiKey();
    seedKey(generated);

    const principal = await provider.authenticate({
      authorization: `Bearer ${generated.key}`,
    });
    expect(principal).not.toBeNull();
    expect(principal?.tenantId).toBe(TENANT_ID);
    expect(principal?.userId).toMatch(/^apikey:/);
    expect(principal?.plan).toBe("self_hosted");
  });

  it("rejects an expired key", async () => {
    const generated = generateApiKey();
    const sb = storage as unknown as {
      requireDb: () => {
        prepare: (sql: string) => { run: (...params: unknown[]) => unknown };
      };
    };
    const db = sb.requireDb();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    db.prepare(
      `INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix, created_by, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      "22222222-2222-2222-2222-222222222222",
      TENANT_ID,
      "expired-key",
      generated.keyHash,
      generated.keyPrefix,
      "test-user",
      yesterday
    );

    await expect(
      provider.authenticate({ authorization: `Bearer ${generated.key}` })
    ).rejects.toThrow(/expired/);
  });

  it("hashApiKey produces SHA-256 hex digest", () => {
    expect(hashApiKey("mgw_test").length).toBe(64);
    expect(hashApiKey("mgw_test")).toBe(hashApiKey("mgw_test"));
  });

  it("generateApiKey produces a unique mgw_ prefixed key with consistent hash", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).toMatch(/^mgw_[a-f0-9]{32}$/);
    expect(a.keyPrefix).toBe(a.key.slice(0, 8));
    expect(a.keyHash).toBe(hashApiKey(a.key));
    expect(a.key).not.toBe(b.key);
  });
});
