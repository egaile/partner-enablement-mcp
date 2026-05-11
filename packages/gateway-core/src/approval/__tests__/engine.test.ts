import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ApprovalEngine } from "../engine.js";
import { SqliteStorageBackend } from "../../storage/sqlite.js";

const TENANT = "00000000-0000-0000-0000-000000000001";

const ctx = {
  correlationId: "corr-1",
  userId: "alice",
  serverName: "atlassian",
  toolName: "deleteJiraIssue",
  params: { issueKey: "HEALTH-42" },
};

describe("ApprovalEngine", () => {
  let storage: SqliteStorageBackend;
  let engine: ApprovalEngine;
  let tenantId: string;

  beforeEach(async () => {
    storage = new SqliteStorageBackend({ path: ":memory:" });
    await storage.init();
    const tenant = await storage.tenants.getOrCreateDefault();
    tenantId = tenant.id;
    engine = new ApprovalEngine({ approvals: storage.approvals });
  });

  afterEach(async () => {
    await storage.close();
  });

  describe("requestApproval", () => {
    it("creates a pending request", async () => {
      const r = await engine.requestApproval(tenantId, ctx);
      expect(r.status).toBe("pending");
      expect(r.id).toBeTruthy();
      expect(r.userId).toBe("alice");
      expect(r.toolName).toBe("deleteJiraIssue");
      expect(r.params).toEqual({ issueKey: "HEALTH-42" });
      expect(r.decidedBy).toBeNull();
      expect(r.decidedAt).toBeNull();
    });

    it("sets a 24-hour expiry by default", async () => {
      const r = await engine.requestApproval(tenantId, ctx);
      const requested = new Date(r.requestedAt).getTime();
      const expires = new Date(r.expiresAt).getTime();
      const diffHours = (expires - requested) / (60 * 60 * 1000);
      expect(diffHours).toBeGreaterThan(23.9);
      expect(diffHours).toBeLessThan(24.1);
    });
  });

  describe("approve / reject", () => {
    it("approves a pending request", async () => {
      const r = await engine.requestApproval(tenantId, ctx);
      const approved = await engine.approve(r.id, tenantId, "admin");
      expect(approved.status).toBe("approved");
      expect(approved.decidedBy).toBe("admin");
      expect(approved.decidedAt).not.toBeNull();
    });

    it("rejects a pending request", async () => {
      const r = await engine.requestApproval(tenantId, ctx);
      const rejected = await engine.reject(r.id, tenantId, "admin");
      expect(rejected.status).toBe("rejected");
    });

    it("throws on double-approve", async () => {
      const r = await engine.requestApproval(tenantId, ctx);
      await engine.approve(r.id, tenantId, "admin");
      await expect(
        engine.approve(r.id, tenantId, "someone-else")
      ).rejects.toThrow(/not found or already decided/i);
    });

    it("throws on reject-after-approve", async () => {
      const r = await engine.requestApproval(tenantId, ctx);
      await engine.approve(r.id, tenantId, "admin");
      await expect(engine.reject(r.id, tenantId, "admin")).rejects.toThrow();
    });

    it("throws on approve from wrong tenant", async () => {
      const r = await engine.requestApproval(tenantId, ctx);
      await expect(
        engine.approve(r.id, "other-tenant", "admin")
      ).rejects.toThrow();
    });
  });

  describe("get", () => {
    it("returns null for missing id", async () => {
      expect(await engine.get("no-such-id", tenantId)).toBeNull();
    });

    it("returns null for wrong tenant", async () => {
      const r = await engine.requestApproval(tenantId, ctx);
      expect(await engine.get(r.id, "other-tenant")).toBeNull();
    });

    it("returns the full record by id+tenant", async () => {
      const r = await engine.requestApproval(tenantId, ctx);
      const fetched = await engine.get(r.id, tenantId);
      expect(fetched?.id).toBe(r.id);
      expect(fetched?.toolName).toBe("deleteJiraIssue");
    });
  });

  describe("checkStatus", () => {
    it("returns null for missing id", async () => {
      expect(await engine.checkStatus("no-such-id", tenantId)).toBeNull();
    });

    it("returns 'pending' for pending request within TTL", async () => {
      const r = await engine.requestApproval(tenantId, ctx);
      expect(await engine.checkStatus(r.id, tenantId)).toBe("pending");
    });

    it("returns 'approved' / 'rejected' after decision", async () => {
      const r1 = await engine.requestApproval(tenantId, ctx);
      await engine.approve(r1.id, tenantId, "admin");
      expect(await engine.checkStatus(r1.id, tenantId)).toBe("approved");

      const r2 = await engine.requestApproval(tenantId, {
        ...ctx,
        correlationId: "corr-2",
      });
      await engine.reject(r2.id, tenantId, "admin");
      expect(await engine.checkStatus(r2.id, tenantId)).toBe("rejected");
    });

    it("returns 'expired' when a still-pending request is past its TTL", async () => {
      // Create directly with a past expiresAt to simulate elapsed time.
      const past = new Date(Date.now() - 60_000).toISOString();
      const direct = await storage.approvals.create({
        tenantId,
        correlationId: "corr-stale",
        userId: ctx.userId,
        serverName: ctx.serverName,
        toolName: ctx.toolName,
        params: ctx.params,
        expiresAt: past,
      });
      expect(await engine.checkStatus(direct.id, tenantId)).toBe("expired");
    });
  });

  describe("getPending", () => {
    it("returns count + data for pending requests only", async () => {
      const r1 = await engine.requestApproval(tenantId, ctx);
      await engine.requestApproval(tenantId, {
        ...ctx,
        correlationId: "corr-2",
      });
      const r3 = await engine.requestApproval(tenantId, {
        ...ctx,
        correlationId: "corr-3",
      });

      await engine.approve(r1.id, tenantId, "admin");
      await engine.reject(r3.id, tenantId, "admin");

      const result = await engine.getPending(tenantId);
      expect(result.count).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe("pending");
    });

    it("honors limit + offset", async () => {
      for (let i = 0; i < 5; i++) {
        await engine.requestApproval(tenantId, {
          ...ctx,
          correlationId: `corr-${i}`,
        });
      }
      const page1 = await engine.getPending(tenantId, {
        limit: 2,
        offset: 0,
      });
      const page2 = await engine.getPending(tenantId, {
        limit: 2,
        offset: 2,
      });
      expect(page1.count).toBe(5);
      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(2);
      // No overlap between pages.
      expect(page1.data[0].id).not.toBe(page2.data[0].id);
    });
  });
});
