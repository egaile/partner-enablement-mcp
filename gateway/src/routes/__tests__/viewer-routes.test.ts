import { afterEach, describe, expect, it, vi } from "vitest";
import express, { type Router } from "express";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

// Tests the per-route viewer behavior added on top of requireAuth: approvals
// params masking and GET /api/me. requireAuth is stubbed to read the role
// from a test header so each request can pick its caller.
vi.mock("../../auth/middleware.js", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    const role = String(req.headers["x-test-role"] ?? "owner");
    req.tenant = {
      tenantId: "t1",
      tenantName: "Demo",
      userId: (req.headers["x-test-user"] as string | undefined) ?? `user_${role}`,
      userRole: role,
      plan: req.headers["x-test-plan"] as string | undefined,
    };
    next();
  },
}));

const getPending = vi.fn();
const getApproval = vi.fn();
const approve = vi.fn(async (id: string) => ({ id, status: "approved" }));
const reject = vi.fn(async (id: string) => ({ id, status: "rejected" }));
vi.mock("../../approval/engine.js", () => ({
  ApprovalEngine: class {
    getPending = getPending;
    get = getApproval;
    approve = approve;
    reject = reject;
  },
}));
vi.mock("../../db/queries/servers.js", () => ({ getServersForTenant: vi.fn() }));
vi.mock("../../db/queries/audit.js", () => ({
  getAuditLogs: vi.fn(),
  getAuditMetrics: vi.fn(),
}));
vi.mock("../../db/queries/alerts.js", () => ({ getAlertsForTenant: vi.fn() }));
vi.mock("../../db/queries/billing.js", () => ({
  getCurrentUsage: vi.fn(),
  getServerCount: vi.fn(),
}));

const { createApprovalsRouter } = await import("../approvals.js");
const { createDashboardRouter } = await import("../dashboard.js");

const state = {
  engines: new Map(),
  safeErrorMessage: (e: unknown) => String(e),
} as never;

let http: HttpServer | undefined;
afterEach(async () => {
  await new Promise<void>((r) => (http ? http.close(() => r()) : r()));
  http = undefined;
});

async function start(router: Router): Promise<string> {
  const app = express();
  app.use(router);
  http = app.listen(0, "127.0.0.1");
  await new Promise((r) => http!.once("listening", r));
  return `http://127.0.0.1:${(http!.address() as AddressInfo).port}`;
}

const PENDING = {
  data: [
    {
      id: "a1",
      tenantId: "t1",
      userId: "apikey:k1",
      serverName: "atlassian-rovo",
      toolName: "editJiraIssue",
      params: { issueKey: "HEALTH-1", fields: { summary: "patient name" } },
      status: "pending",
    },
  ],
  count: 1,
};

describe("GET /api/approvals", () => {
  it("hides tool arguments from viewers but keeps the rest of the record", async () => {
    getPending.mockResolvedValue(structuredClone(PENDING));
    const base = await start(createApprovalsRouter(state));

    const res = await fetch(`${base}/api/approvals`, {
      headers: { "x-test-role": "viewer" },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.data[0]).toMatchObject({
      id: "a1",
      toolName: "editJiraIssue",
      status: "pending",
      params: {},
    });
    expect(JSON.stringify(body)).not.toContain("patient name");
  });

  it("returns full tool arguments to admins", async () => {
    getPending.mockResolvedValue(structuredClone(PENDING));
    const base = await start(createApprovalsRouter(state));

    const res = await fetch(`${base}/api/approvals`, {
      headers: { "x-test-role": "owner" },
    });
    const body = await res.json();

    expect(body.data[0].params).toEqual(PENDING.data[0].params);
  });
});

describe("GET /api/me", () => {
  it("reports readOnly for viewers only and defaults plan to starter", async () => {
    const base = await start(createDashboardRouter(state));

    const viewer = await (
      await fetch(`${base}/api/me`, { headers: { "x-test-role": "viewer" } })
    ).json();
    const owner = await (
      await fetch(`${base}/api/me`, {
        headers: { "x-test-role": "owner", "x-test-plan": "pro" },
      })
    ).json();

    expect(viewer).toEqual({
      tenantId: "t1",
      tenantName: "Demo",
      userId: "user_viewer",
      role: "viewer",
      plan: "starter",
      readOnly: true,
      demo: false,
    });
    expect(owner).toMatchObject({ role: "owner", plan: "pro", readOnly: false, demo: false });
  });

  it("flags the shared demo login", async () => {
    vi.stubEnv("DEMO_CLERK_USER_IDS", "user_demo");
    const base = await start(createDashboardRouter(state));
    const me = await (
      await fetch(`${base}/api/me`, {
        headers: { "x-test-role": "viewer", "x-test-user": "user_demo" },
      })
    ).json();
    vi.unstubAllEnvs();
    expect(me).toMatchObject({ readOnly: true, demo: true });
  });
});

describe("POST /api/approvals/:id/approve|reject", () => {
  async function decide(action: "approve" | "reject", user: string) {
    getApproval.mockResolvedValue({ ...PENDING.data[0] });
    const base = await start(createApprovalsRouter(state));
    return fetch(`${base}/api/approvals/a1/${action}`, {
      method: "POST",
      headers: { "x-test-user": user },
    });
  }

  it("lets a dashboard user decide someone else's request", async () => {
    approve.mockClear();
    const res = await decide("approve", "user_owner");
    expect(res.status).toBe(200);
    expect(approve).toHaveBeenCalledWith("a1", "t1", "user_owner");
  });

  it.each(["approve", "reject"] as const)(
    "refuses to %s with an API key",
    async (action) => {
      approve.mockClear();
      reject.mockClear();
      const res = await decide(action, "apikey:k2");
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/API keys/);
      expect(approve).not.toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();
    }
  );

  it.each(["approve", "reject"] as const)(
    "refuses to %s your own request",
    async (action) => {
      approve.mockClear();
      reject.mockClear();
      getApproval.mockResolvedValue({ ...PENDING.data[0], userId: "user_owner" });
      const base = await start(createApprovalsRouter(state));
      const res = await fetch(`${base}/api/approvals/a1/${action}`, {
        method: "POST",
        headers: { "x-test-user": "user_owner" },
      });
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/you made/);
      expect(approve).not.toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();
    }
  );
});

describe("approver roles", () => {
  it.each([
    ["member", "approve"],
    ["viewer", "approve"],
    ["member", "reject"],
    ["viewer", "reject"],
  ] as const)("a %s can't %s", async (role, action) => {
    approve.mockClear();
    reject.mockClear();
    getApproval.mockResolvedValue({ ...PENDING.data[0] });
    const base = await start(createApprovalsRouter(state));
    const res = await fetch(`${base}/api/approvals/a1/${action}`, {
      method: "POST",
      headers: { "x-test-role": role },
    });
    expect(res.status).toBe(403);
    expect(approve).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });

  it("an admin can approve", async () => {
    approve.mockClear();
    getApproval.mockResolvedValue({ ...PENDING.data[0] });
    const base = await start(createApprovalsRouter(state));
    const res = await fetch(`${base}/api/approvals/a1/approve`, {
      method: "POST",
      headers: { "x-test-role": "admin" },
    });
    expect(res.status).toBe(200);
    expect(approve).toHaveBeenCalled();
  });
});

describe("deciding a request that's no longer pending", () => {
  it.each(["approve", "reject"] as const)("%s returns 409", async (action) => {
    getApproval.mockResolvedValue({ ...PENDING.data[0] });
    const fn = action === "approve" ? approve : reject;
    fn.mockRejectedValueOnce(Object.assign(new Error("no rows"), { code: "PGRST116" }));
    const base = await start(createApprovalsRouter(state));
    const res = await fetch(`${base}/api/approvals/a1/${action}`, { method: "POST" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/no longer pending/);
  });
});

describe("deciding an unknown request", () => {
  it.each(["approve", "reject"] as const)("%s returns 404", async (action) => {
    approve.mockClear();
    reject.mockClear();
    getApproval.mockResolvedValue(null);
    const base = await start(createApprovalsRouter(state));
    const res = await fetch(`${base}/api/approvals/nope/${action}`, { method: "POST" });
    expect(res.status).toBe(404);
    expect(approve).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });
});

