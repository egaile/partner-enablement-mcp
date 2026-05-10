import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PolicyEngine, type PoliciesPort } from "../engine.js";
import type { PolicyRuleRecord } from "../../storage/types.js";

const TENANT = "tenant-123";

function makeRule(
  overrides: Partial<PolicyRuleRecord> &
    Pick<PolicyRuleRecord, "id" | "name" | "priority" | "action" | "conditions">
): PolicyRuleRecord {
  return {
    tenantId: TENANT,
    description: null,
    modifiers: null,
    enabled: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeFakePolicies(): {
  port: PoliciesPort;
  list: ReturnType<typeof vi.fn>;
} {
  const list = vi.fn<(tenantId: string) => Promise<PolicyRuleRecord[]>>();
  list.mockResolvedValue([]);
  return {
    port: { listEnabledForTenant: (id: string) => list(id) },
    list,
  };
}

describe("PolicyEngine", () => {
  let engine: PolicyEngine;
  let list: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const fake = makeFakePolicies();
    list = fake.list;
    engine = new PolicyEngine({
      policies: fake.port,
      cacheTtlMs: 60_000,
    });
  });

  afterEach(() => {
    engine.clearCache();
  });

  describe("server glob matching", () => {
    it("matches exact server name", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-finance-server",
          priority: 10,
          action: "deny",
          conditions: { servers: ["finance-server"] },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "finance-server",
        toolName: "get_balance",
      });
      expect(d.action).toBe("deny");
      expect(d.ruleId).toBe("r1");
    });

    it("matches server name with wildcard glob", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-all-finance",
          priority: 10,
          action: "deny",
          conditions: { servers: ["finance-*"] },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "finance-prod",
        toolName: "transfer",
      });
      expect(d.action).toBe("deny");
    });

    it("does not match non-matching server", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-finance",
          priority: 10,
          action: "deny",
          conditions: { servers: ["finance-*"] },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "hr-server",
        toolName: "get_employee",
      });
      expect(d.action).toBe("allow");
      expect(d.ruleId).toBeNull();
    });
  });

  describe("tool glob matching", () => {
    it("matches exact tool name", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-delete",
          priority: 10,
          action: "deny",
          conditions: { tools: ["delete_user"] },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "admin-server",
        toolName: "delete_user",
      });
      expect(d.action).toBe("deny");
    });

    it("matches tool name with glob pattern", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-all-deletes",
          priority: 10,
          action: "deny",
          conditions: { tools: ["delete_*"] },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "admin-server",
        toolName: "delete_record",
      });
      expect(d.action).toBe("deny");
    });
  });

  describe("user list matching", () => {
    it("matches when userId is in the user list", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-specific-users",
          priority: 10,
          action: "deny",
          conditions: { users: ["user-a", "user-b"] },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
        userId: "user-a",
      });
      expect(d.action).toBe("deny");
    });

    it("does not match when userId is not in the list", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-specific-users",
          priority: 10,
          action: "deny",
          conditions: { users: ["user-a", "user-b"] },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
        userId: "user-c",
      });
      expect(d.action).toBe("allow");
    });

    it("does not match when userId is undefined and rule has users", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-specific-users",
          priority: 10,
          action: "deny",
          conditions: { users: ["user-a"] },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });
      expect(d.action).toBe("allow");
    });
  });

  describe("time window matching", () => {
    it("matches when current time is within the window", async () => {
      const now = new Date();
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "business-hours-only",
          priority: 10,
          action: "deny",
          conditions: {
            timeWindows: [
              {
                daysOfWeek: [now.getDay()],
                startHour: now.getHours(),
                endHour: now.getHours() + 1,
              },
            ],
          },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });
      expect(d.action).toBe("deny");
    });

    it("does not match zero-width window", async () => {
      const h = (new Date().getHours() + 12) % 24;
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "off-hours",
          priority: 10,
          action: "deny",
          conditions: {
            timeWindows: [{ startHour: h, endHour: h }],
          },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });
      expect(d.action).toBe("allow");
    });

    it("does not match when day of week is wrong", async () => {
      const wrongDay = (new Date().getDay() + 3) % 7;
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "wrong-day",
          priority: 10,
          action: "deny",
          conditions: {
            timeWindows: [
              { daysOfWeek: [wrongDay], startHour: 0, endHour: 24 },
            ],
          },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });
      expect(d.action).toBe("allow");
    });
  });

  describe("priority ordering (lower = higher priority)", () => {
    it("applies the first matching rule", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r-high-priority",
          name: "deny-all",
          priority: 1,
          action: "deny",
          conditions: {},
        }),
        makeRule({
          id: "r-low-priority",
          name: "allow-all",
          priority: 100,
          action: "allow",
          conditions: {},
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "any-server",
        toolName: "any-tool",
      });
      expect(d.action).toBe("deny");
      expect(d.ruleId).toBe("r-high-priority");
    });

    it("falls through to lower-priority rule when higher one doesn't match", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-finance",
          priority: 1,
          action: "deny",
          conditions: { servers: ["finance-*"] },
        }),
        makeRule({
          id: "r2",
          name: "log-everything",
          priority: 100,
          action: "log_only",
          conditions: {},
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "hr-server",
        toolName: "get_employee",
      });
      expect(d.action).toBe("log_only");
      expect(d.ruleId).toBe("r2");
    });
  });

  describe("default allow", () => {
    it("returns allow with null ruleId when no rules match", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-finance",
          priority: 1,
          action: "deny",
          conditions: { servers: ["finance-*"] },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "hr-server",
        toolName: "list_employees",
      });
      expect(d.action).toBe("allow");
      expect(d.ruleId).toBeNull();
      expect(d.ruleName).toBeNull();
      expect(d.modifiers).toEqual({});
    });

    it("returns allow when there are no rules at all", async () => {
      list.mockResolvedValue([]);
      const d = await engine.evaluate(TENANT, {
        serverName: "any",
        toolName: "any",
      });
      expect(d.action).toBe("allow");
    });
  });

  describe("modifiers propagation", () => {
    it("returns modifiers from the matching rule", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "rate-limited",
          priority: 1,
          action: "allow",
          conditions: {},
          modifiers: { maxCallsPerMinute: 10, redactPII: true },
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });
      expect(d.modifiers).toEqual({
        maxCallsPerMinute: 10,
        redactPII: true,
      });
    });

    it("returns empty modifiers when rule has null modifiers", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "no-modifiers",
          priority: 1,
          action: "deny",
          conditions: {},
          modifiers: null,
        }),
      ]);
      const d = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });
      expect(d.modifiers).toEqual({});
    });
  });

  describe("cache behavior", () => {
    it("second call uses cached rules", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-all",
          priority: 1,
          action: "deny",
          conditions: {},
        }),
      ]);
      await engine.evaluate(TENANT, { serverName: "s", toolName: "t" });
      await engine.evaluate(TENANT, { serverName: "s", toolName: "t" });
      expect(list).toHaveBeenCalledTimes(1);
    });

    it("clearCache() forces re-fetch on next evaluate", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-all",
          priority: 1,
          action: "deny",
          conditions: {},
        }),
      ]);
      await engine.evaluate(TENANT, { serverName: "s", toolName: "t" });
      engine.clearCache();
      await engine.evaluate(TENANT, { serverName: "s", toolName: "t" });
      expect(list).toHaveBeenCalledTimes(2);
    });

    it("clearCache(tenantId) only clears that tenant", async () => {
      list.mockResolvedValue([]);
      await engine.evaluate("tenant-a", { serverName: "s", toolName: "t" });
      await engine.evaluate("tenant-b", { serverName: "s", toolName: "t" });
      expect(list).toHaveBeenCalledTimes(2);

      engine.clearCache("tenant-a");

      await engine.evaluate("tenant-a", { serverName: "s", toolName: "t" });
      await engine.evaluate("tenant-b", { serverName: "s", toolName: "t" });
      expect(list).toHaveBeenCalledTimes(3);
    });
  });

  describe("combined conditions", () => {
    it("requires all conditions to match (server AND tool AND user)", async () => {
      list.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "strict-rule",
          priority: 1,
          action: "deny",
          conditions: {
            servers: ["prod-*"],
            tools: ["delete_*"],
            users: ["user-admin"],
          },
        }),
      ]);

      const d1 = await engine.evaluate(TENANT, {
        serverName: "prod-east",
        toolName: "delete_record",
        userId: "user-admin",
      });
      expect(d1.action).toBe("deny");

      engine.clearCache();
      const d2 = await engine.evaluate(TENANT, {
        serverName: "staging-east",
        toolName: "delete_record",
        userId: "user-admin",
      });
      expect(d2.action).toBe("allow");

      engine.clearCache();
      const d3 = await engine.evaluate(TENANT, {
        serverName: "prod-east",
        toolName: "get_record",
        userId: "user-admin",
      });
      expect(d3.action).toBe("allow");

      engine.clearCache();
      const d4 = await engine.evaluate(TENANT, {
        serverName: "prod-east",
        toolName: "delete_record",
        userId: "user-viewer",
      });
      expect(d4.action).toBe("allow");
    });
  });
});
