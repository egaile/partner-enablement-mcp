import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PolicyRuleRecord } from "../../db/queries/policies.js";

// ---------------------------------------------------------------------------
// Mock getPoliciesForTenant — must come before importing the module under test
// ---------------------------------------------------------------------------

const mockGetPolicies = vi.fn<(tenantId: string) => Promise<PolicyRuleRecord[]>>();

vi.mock("../../db/queries/policies.js", () => ({
  getPoliciesForTenant: (...args: unknown[]) => mockGetPolicies(args[0] as string),
}));

// Mock loadConfig so PolicyEngine constructor doesn't need env vars
vi.mock("../../config.js", () => ({
  loadConfig: () => ({
    policyCacheTtlMs: 30_000,
    auditBatchSize: 50,
    auditFlushIntervalMs: 5_000,
  }),
}));

// Now import the module under test
const { PolicyEngine } = await import("../engine.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = "tenant-123";

function makeRule(overrides: Partial<PolicyRuleRecord> & Pick<PolicyRuleRecord, "id" | "name" | "priority" | "action" | "conditions">): PolicyRuleRecord {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PolicyEngine", () => {
  let engine: InstanceType<typeof PolicyEngine>;

  beforeEach(() => {
    mockGetPolicies.mockReset();
    engine = new PolicyEngine(60_000); // 60s cache TTL for tests
  });

  afterEach(() => {
    engine.clearCache();
  });

  // ---- Server glob matching ----

  describe("server glob matching", () => {
    it("matches exact server name", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-finance-server",
          priority: 10,
          action: "deny",
          conditions: { servers: ["finance-server"] },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "finance-server",
        toolName: "get_balance",
      });

      expect(decision.action).toBe("deny");
      expect(decision.ruleId).toBe("r1");
    });

    it("matches server name with wildcard glob", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-all-finance",
          priority: 10,
          action: "deny",
          conditions: { servers: ["finance-*"] },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "finance-prod",
        toolName: "transfer",
      });
      expect(decision.action).toBe("deny");
    });

    it("does not match non-matching server", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-finance",
          priority: 10,
          action: "deny",
          conditions: { servers: ["finance-*"] },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "hr-server",
        toolName: "get_employee",
      });

      expect(decision.action).toBe("allow");
      expect(decision.ruleId).toBeNull();
    });
  });

  // ---- Tool glob matching ----

  describe("tool glob matching", () => {
    it("matches exact tool name", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-delete",
          priority: 10,
          action: "deny",
          conditions: { tools: ["delete_user"] },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "admin-server",
        toolName: "delete_user",
      });
      expect(decision.action).toBe("deny");
    });

    it("matches tool name with glob pattern", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-all-deletes",
          priority: 10,
          action: "deny",
          conditions: { tools: ["delete_*"] },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "admin-server",
        toolName: "delete_record",
      });
      expect(decision.action).toBe("deny");
    });
  });

  // ---- User list matching ----

  describe("user list matching", () => {
    it("matches when userId is in the user list", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-specific-users",
          priority: 10,
          action: "deny",
          conditions: { users: ["user-a", "user-b"] },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
        userId: "user-a",
      });
      expect(decision.action).toBe("deny");
    });

    it("does not match when userId is not in the list", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-specific-users",
          priority: 10,
          action: "deny",
          conditions: { users: ["user-a", "user-b"] },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
        userId: "user-c",
      });
      expect(decision.action).toBe("allow");
    });

    it("does not match when userId is undefined and rule has users", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-specific-users",
          priority: 10,
          action: "deny",
          conditions: { users: ["user-a"] },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });
      expect(decision.action).toBe("allow");
    });
  });

  // ---- Time windows ----

  describe("time window matching", () => {
    it("matches when current time is within the window", async () => {
      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getHours();

      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "business-hours-only",
          priority: 10,
          action: "deny",
          conditions: {
            timeWindows: [
              {
                daysOfWeek: [currentDay],
                startHour: currentHour,
                endHour: currentHour + 1,
              },
            ],
          },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });
      expect(decision.action).toBe("deny");
    });

    it("does not match when current time is outside the window", async () => {
      const now = new Date();
      const currentHour = now.getHours();
      // Use an hour range that is guaranteed to not include current hour
      const outOfRangeStart = (currentHour + 12) % 24;
      const outOfRangeEnd = (currentHour + 13) % 24;

      // Only works if outOfRangeEnd > outOfRangeStart (no midnight wrap concern for test)
      // Use a simpler approach: pick hour range entirely in the past/future
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "off-hours",
          priority: 10,
          action: "deny",
          conditions: {
            timeWindows: [
              {
                startHour: outOfRangeStart,
                endHour: outOfRangeStart, // start === end means zero-width window
              },
            ],
          },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });
      expect(decision.action).toBe("allow");
    });

    it("does not match when day of week is wrong", async () => {
      const now = new Date();
      const currentDay = now.getDay();
      const wrongDay = (currentDay + 3) % 7;

      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "wrong-day",
          priority: 10,
          action: "deny",
          conditions: {
            timeWindows: [
              {
                daysOfWeek: [wrongDay],
                startHour: 0,
                endHour: 24,
              },
            ],
          },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });
      expect(decision.action).toBe("allow");
    });
  });

  // ---- Priority ordering ----

  describe("priority ordering (lower number = higher priority)", () => {
    it("applies the first matching rule by priority", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r-low-priority",
          name: "allow-all",
          priority: 100,
          action: "allow",
          conditions: {},
        }),
        makeRule({
          id: "r-high-priority",
          name: "deny-all",
          priority: 1,
          action: "deny",
          conditions: {},
        }),
      ]);

      // getPoliciesForTenant returns sorted by priority ASC,
      // so the deny rule (priority=1) should be first in the array.
      // However, our mock returns them in insertion order. Let's fix:
      // The real DB sorts, but our mock won't. The engine iterates in order.
      // Re-order to match what the real DB would return:
      mockGetPolicies.mockResolvedValue([
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

      engine.clearCache();

      const decision = await engine.evaluate(TENANT, {
        serverName: "any-server",
        toolName: "any-tool",
      });
      expect(decision.action).toBe("deny");
      expect(decision.ruleId).toBe("r-high-priority");
    });

    it("falls through to lower-priority rule when higher one doesn't match", async () => {
      mockGetPolicies.mockResolvedValue([
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

      const decision = await engine.evaluate(TENANT, {
        serverName: "hr-server",
        toolName: "get_employee",
      });
      expect(decision.action).toBe("log_only");
      expect(decision.ruleId).toBe("r2");
    });
  });

  // ---- Default allow ----

  describe("default allow", () => {
    it("returns allow with null ruleId/ruleName when no rules match", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-finance",
          priority: 1,
          action: "deny",
          conditions: { servers: ["finance-*"] },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "hr-server",
        toolName: "list_employees",
      });

      expect(decision.action).toBe("allow");
      expect(decision.ruleId).toBeNull();
      expect(decision.ruleName).toBeNull();
      expect(decision.modifiers).toEqual({});
    });

    it("returns allow when there are no rules at all", async () => {
      mockGetPolicies.mockResolvedValue([]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "any-server",
        toolName: "any-tool",
      });

      expect(decision.action).toBe("allow");
    });
  });

  // ---- Modifiers ----

  describe("modifiers propagation", () => {
    it("returns modifiers from the matching rule", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "rate-limited",
          priority: 1,
          action: "allow",
          conditions: {},
          modifiers: { maxCallsPerMinute: 10, redactPII: true },
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });

      expect(decision.action).toBe("allow");
      expect(decision.modifiers).toEqual({ maxCallsPerMinute: 10, redactPII: true });
    });

    it("returns empty modifiers when rule has null modifiers", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "no-modifiers",
          priority: 1,
          action: "deny",
          conditions: {},
          modifiers: null,
        }),
      ]);

      const decision = await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });

      expect(decision.modifiers).toEqual({});
    });
  });

  // ---- Cache behavior ----

  describe("cache behavior", () => {
    it("second call uses cached rules (does not call getPoliciesForTenant again)", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-all",
          priority: 1,
          action: "deny",
          conditions: {},
        }),
      ]);

      await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });

      await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });

      expect(mockGetPolicies).toHaveBeenCalledTimes(1);
    });

    it("clearCache() forces re-fetch on next evaluate", async () => {
      mockGetPolicies.mockResolvedValue([
        makeRule({
          id: "r1",
          name: "deny-all",
          priority: 1,
          action: "deny",
          conditions: {},
        }),
      ]);

      await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });

      engine.clearCache();

      await engine.evaluate(TENANT, {
        serverName: "server",
        toolName: "tool",
      });

      expect(mockGetPolicies).toHaveBeenCalledTimes(2);
    });

    it("clearCache(tenantId) only clears that tenant", async () => {
      mockGetPolicies.mockResolvedValue([]);

      await engine.evaluate("tenant-a", {
        serverName: "s",
        toolName: "t",
      });
      await engine.evaluate("tenant-b", {
        serverName: "s",
        toolName: "t",
      });

      expect(mockGetPolicies).toHaveBeenCalledTimes(2);

      // Clear only tenant-a
      engine.clearCache("tenant-a");

      await engine.evaluate("tenant-a", {
        serverName: "s",
        toolName: "t",
      });
      await engine.evaluate("tenant-b", {
        serverName: "s",
        toolName: "t",
      });

      // tenant-a was re-fetched, tenant-b was still cached
      expect(mockGetPolicies).toHaveBeenCalledTimes(3);
    });
  });

  // ---- Combined conditions ----

  describe("combined conditions", () => {
    it("requires all conditions to match (server AND tool AND user)", async () => {
      mockGetPolicies.mockResolvedValue([
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

      // All match
      const d1 = await engine.evaluate(TENANT, {
        serverName: "prod-east",
        toolName: "delete_record",
        userId: "user-admin",
      });
      expect(d1.action).toBe("deny");

      engine.clearCache();

      // Server doesn't match
      const d2 = await engine.evaluate(TENANT, {
        serverName: "staging-east",
        toolName: "delete_record",
        userId: "user-admin",
      });
      expect(d2.action).toBe("allow");

      engine.clearCache();

      // Tool doesn't match
      const d3 = await engine.evaluate(TENANT, {
        serverName: "prod-east",
        toolName: "get_record",
        userId: "user-admin",
      });
      expect(d3.action).toBe("allow");

      engine.clearCache();

      // User doesn't match
      const d4 = await engine.evaluate(TENANT, {
        serverName: "prod-east",
        toolName: "delete_record",
        userId: "user-viewer",
      });
      expect(d4.action).toBe("allow");
    });
  });
});
