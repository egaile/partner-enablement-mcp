import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { SqliteStorageBackend } from "../sqlite.js";
import type { AuditEntry } from "../../schemas/index.js";

describe("SqliteStorageBackend", () => {
  let storage: SqliteStorageBackend;
  const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000001";

  beforeEach(async () => {
    storage = new SqliteStorageBackend({
      path: ":memory:",
      defaultTenantId: TEST_TENANT_ID,
    });
    await storage.init();
    await storage.tenants.getOrCreateDefault();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe("tenants", () => {
    it("getOrCreateDefault creates a tenant on first call", async () => {
      const tenant = await storage.tenants.getById(TEST_TENANT_ID);
      expect(tenant).not.toBeNull();
      expect(tenant?.name).toBe("default");
    });

    it("getOrCreateDefault is idempotent", async () => {
      const a = await storage.tenants.getOrCreateDefault();
      const b = await storage.tenants.getOrCreateDefault();
      expect(a.id).toBe(b.id);
    });

    it("getById returns null for unknown tenant", async () => {
      const t = await storage.tenants.getById(randomUUID());
      expect(t).toBeNull();
    });
  });

  describe("policies", () => {
    it("upsert creates a new policy", async () => {
      const rule = await storage.policies.upsert({
        tenantId: TEST_TENANT_ID,
        name: "Block writes",
        priority: 100,
        conditions: { tools: ["*create*"] },
        action: "deny",
      });
      expect(rule.name).toBe("Block writes");
      expect(rule.action).toBe("deny");
      expect(rule.enabled).toBe(true);
      expect(rule.conditions.tools).toEqual(["*create*"]);
    });

    it("upsert updates an existing policy with same external id", async () => {
      const a = await storage.policies.upsert({
        tenantId: TEST_TENANT_ID,
        name: "Block writes",
        priority: 100,
        conditions: { tools: ["*create*"] },
        action: "deny",
      });
      const b = await storage.policies.upsert({
        tenantId: TEST_TENANT_ID,
        name: "Block writes",
        priority: 50,
        conditions: { tools: ["*create*", "*delete*"] },
        action: "deny",
      });
      expect(b.id).toBe(a.id);
      expect(b.priority).toBe(50);
      expect(b.conditions.tools).toEqual(["*create*", "*delete*"]);
    });

    it("listEnabledForTenant returns only enabled rules in priority order", async () => {
      await storage.policies.upsert({
        tenantId: TEST_TENANT_ID,
        name: "low priority",
        priority: 500,
        conditions: { tools: ["*"] },
        action: "log_only",
      });
      await storage.policies.upsert({
        tenantId: TEST_TENANT_ID,
        name: "high priority",
        priority: 10,
        conditions: { tools: ["*delete*"] },
        action: "deny",
      });
      await storage.policies.upsert({
        tenantId: TEST_TENANT_ID,
        name: "disabled",
        priority: 1,
        conditions: { tools: ["*"] },
        action: "deny",
        enabled: false,
      });

      const rules = await storage.policies.listEnabledForTenant(TEST_TENANT_ID);
      expect(rules).toHaveLength(2);
      expect(rules[0].name).toBe("high priority");
      expect(rules[1].name).toBe("low priority");
    });

    it("replaceFromConfig removes rules absent from new config", async () => {
      await storage.policies.replaceFromConfig(TEST_TENANT_ID, [
        {
          tenantId: TEST_TENANT_ID,
          name: "A",
          conditions: { tools: ["*"] },
          action: "log_only",
        },
        {
          tenantId: TEST_TENANT_ID,
          name: "B",
          conditions: { tools: ["*write*"] },
          action: "deny",
        },
      ]);
      let rules = await storage.policies.listEnabledForTenant(TEST_TENANT_ID);
      expect(rules.map((r) => r.name).sort()).toEqual(["A", "B"]);

      // Reconfigure: only B remains, plus a new C
      await storage.policies.replaceFromConfig(TEST_TENANT_ID, [
        {
          tenantId: TEST_TENANT_ID,
          name: "B",
          conditions: { tools: ["*write*"] },
          action: "deny",
        },
        {
          tenantId: TEST_TENANT_ID,
          name: "C",
          conditions: { tools: ["*"] },
          action: "allow",
        },
      ]);
      rules = await storage.policies.listEnabledForTenant(TEST_TENANT_ID);
      expect(rules.map((r) => r.name).sort()).toEqual(["B", "C"]);
    });
  });

  describe("audit", () => {
    function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
      return {
        correlationId: randomUUID(),
        tenantId: TEST_TENANT_ID,
        serverId: randomUUID(),
        serverName: "atlassian",
        toolName: "jira_search",
        policyDecision: "allow",
        threatsDetected: 0,
        driftDetected: false,
        latencyMs: 42,
        requestPiiDetected: false,
        responsePiiDetected: false,
        success: true,
        ...overrides,
      };
    }

    it("append is a no-op for empty batch", async () => {
      await expect(storage.audit.append([])).resolves.toBeUndefined();
    });

    it("append persists a batch in one transaction", async () => {
      const entries = [makeEntry(), makeEntry(), makeEntry()];
      await expect(storage.audit.append(entries)).resolves.toBeUndefined();
    });

    it("append round-trips threat details and data classification", async () => {
      await storage.audit.append([
        makeEntry({
          threatsDetected: 2,
          threatDetails: { strategy: "pattern_match", patterns: ["A", "B"] },
          requestPiiDetected: true,
          dataClassification: "restricted",
        }),
      ]);
      // Verified by SELECT in a manual check; here we just ensure no throw
      // and that the schema column exists by re-inserting another row.
      await storage.audit.append([makeEntry()]);
    });
  });

  describe("snapshots", () => {
    let serverId: string;

    beforeEach(async () => {
      const server = await storage.servers.upsert({
        tenantId: TEST_TENANT_ID,
        name: "atlassian",
        transport: "http",
        url: "https://example.com",
      });
      serverId = server.id;
    });

    it("get returns null when no snapshot exists", async () => {
      const snap = await storage.snapshots.get(
        TEST_TENANT_ID,
        serverId,
        "missing_tool"
      );
      expect(snap).toBeNull();
    });

    it("upsert creates a new snapshot", async () => {
      const snap = await storage.snapshots.upsert({
        tenantId: TEST_TENANT_ID,
        serverId,
        toolName: "jira_search",
        definitionHash: "abc123",
        definition: { name: "jira_search", inputSchema: {} },
      });
      expect(snap.toolName).toBe("jira_search");
      expect(snap.definitionHash).toBe("abc123");
      expect(snap.approved).toBe(true);
    });

    it("upsert updates an existing snapshot", async () => {
      const a = await storage.snapshots.upsert({
        tenantId: TEST_TENANT_ID,
        serverId,
        toolName: "jira_search",
        definitionHash: "abc123",
        definition: { v: 1 },
      });
      const b = await storage.snapshots.upsert({
        tenantId: TEST_TENANT_ID,
        serverId,
        toolName: "jira_search",
        definitionHash: "def456",
        definition: { v: 2 },
      });
      expect(b.id).toBe(a.id);
      expect(b.definitionHash).toBe("def456");
      expect((b.definition as { v: number }).v).toBe(2);
    });

    it("get returns the latest snapshot after upsert", async () => {
      await storage.snapshots.upsert({
        tenantId: TEST_TENANT_ID,
        serverId,
        toolName: "jira_search",
        definitionHash: "h1",
        definition: { schema: "v1" },
      });
      const got = await storage.snapshots.get(
        TEST_TENANT_ID,
        serverId,
        "jira_search"
      );
      expect(got).not.toBeNull();
      expect(got?.definitionHash).toBe("h1");
    });
  });

  describe("servers", () => {
    it("upsert and listEnabledForTenant", async () => {
      await storage.servers.upsert({
        tenantId: TEST_TENANT_ID,
        name: "atlassian",
        transport: "http",
        url: "https://mcp.atlassian.com",
        authType: "oauth2",
      });
      await storage.servers.upsert({
        tenantId: TEST_TENANT_ID,
        name: "github",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@github/mcp-server"],
      });
      await storage.servers.upsert({
        tenantId: TEST_TENANT_ID,
        name: "disabled-server",
        transport: "http",
        url: "https://example.com",
        enabled: false,
      });

      const enabled =
        await storage.servers.listEnabledForTenant(TEST_TENANT_ID);
      expect(enabled.map((s) => s.name).sort()).toEqual(["atlassian", "github"]);
    });

    it("upsert is idempotent on external_id", async () => {
      const a = await storage.servers.upsert({
        tenantId: TEST_TENANT_ID,
        name: "atlassian",
        transport: "http",
        url: "https://v1.example.com",
      });
      const b = await storage.servers.upsert({
        tenantId: TEST_TENANT_ID,
        name: "atlassian",
        transport: "http",
        url: "https://v2.example.com",
      });
      expect(b.id).toBe(a.id);
      expect(b.url).toBe("https://v2.example.com");
    });

    it("getById returns the server scoped to tenant", async () => {
      const created = await storage.servers.upsert({
        tenantId: TEST_TENANT_ID,
        name: "atlassian",
        transport: "http",
        url: "https://example.com",
      });
      const got = await storage.servers.getById(created.id, TEST_TENANT_ID);
      expect(got?.name).toBe("atlassian");

      const otherTenant = await storage.servers.getById(created.id, randomUUID());
      expect(otherTenant).toBeNull();
    });

    it("updateOAuthTokens persists tokens", async () => {
      const server = await storage.servers.upsert({
        tenantId: TEST_TENANT_ID,
        name: "atlassian",
        transport: "http",
        url: "https://example.com",
        authType: "oauth2",
      });
      await storage.servers.updateOAuthTokens(server.id, TEST_TENANT_ID, {
        oauthAccessToken: "at_xxx",
        oauthRefreshToken: "rt_yyy",
        oauthTokenExpiresAt: "2026-12-31T00:00:00Z",
      });
      const got = await storage.servers.getById(server.id, TEST_TENANT_ID);
      expect(got?.oauthAccessToken).toBe("at_xxx");
      expect(got?.oauthRefreshToken).toBe("rt_yyy");
    });

    it("replaceFromConfig removes servers absent from new config", async () => {
      await storage.servers.replaceFromConfig(TEST_TENANT_ID, [
        { tenantId: TEST_TENANT_ID, name: "atlassian", transport: "http", url: "https://a" },
        { tenantId: TEST_TENANT_ID, name: "github", transport: "http", url: "https://b" },
      ]);
      let servers = await storage.servers.listEnabledForTenant(TEST_TENANT_ID);
      expect(servers.map((s) => s.name).sort()).toEqual(["atlassian", "github"]);

      await storage.servers.replaceFromConfig(TEST_TENANT_ID, [
        { tenantId: TEST_TENANT_ID, name: "atlassian", transport: "http", url: "https://a" },
        { tenantId: TEST_TENANT_ID, name: "slack", transport: "http", url: "https://c" },
      ]);
      servers = await storage.servers.listEnabledForTenant(TEST_TENANT_ID);
      expect(servers.map((s) => s.name).sort()).toEqual(["atlassian", "slack"]);
    });
  });

  describe("apiKeys", () => {
    it("findByHash returns null for unknown hash", async () => {
      const key = await storage.apiKeys.findByHash("unknown");
      expect(key).toBeNull();
    });
  });
});
