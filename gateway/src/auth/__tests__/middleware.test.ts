import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../types.js";

const tenantLookup = vi.fn();

vi.mock("../clerk.js", () => ({
  verifyToken: vi.fn(async (token: string) => ({ userId: token })),
}));
vi.mock("../../db/queries/tenants.js", () => ({
  getTenantForUser: (id: string) => tenantLookup(id),
  getTenantById: vi.fn(),
}));
vi.mock("../../db/queries/api-keys.js", () => ({
  getApiKeyByHash: vi.fn(),
  updateLastUsed: vi.fn(),
}));
const tenantUsersInsert = vi.fn(async (_row: unknown) => ({ error: null }));
vi.mock("../../db/client.js", () => ({
  getSupabaseClient: () => ({
    from: () => ({ insert: (row: unknown) => tenantUsersInsert(row) }),
  }),
}));

const { requireAuth } = await import("../middleware.js");

const TENANT = { id: "t1", name: "Demo", plan: "pro" };

function run(userId: string, method: string, path: string, baseUrl = "") {
  const req = {
    method,
    baseUrl,
    path,
    headers: { authorization: `Bearer ${userId}` },
  } as unknown as AuthenticatedRequest;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const next = vi.fn();
  return requireAuth(req, res as unknown as Response, next).then(() => ({
    req,
    res,
    next,
  }));
}

describe("requireAuth read-only enforcement", () => {

  beforeEach(() => {
    tenantLookup.mockImplementation(async (id: string) => ({
      tenant: TENANT,
      role: id === "user_viewer" ? "viewer" : "owner",
    }));
    vi.stubEnv("DEMO_CLERK_USER_IDS", "user_demo");
    vi.stubEnv("DEMO_CLERK_USER_ID", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets a viewer read", async () => {
    const { res, next } = await run("user_viewer", "GET", "/api/servers");
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("blocks a viewer write with code read_only", async () => {
    const { res, next } = await run("user_viewer", "DELETE", "/api/servers/s1");
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: "read_only" });
  });

  it("forces demo users to viewer even if tenant_users says owner", async () => {
    const { req, res, next } = await run("user_demo", "POST", "/api/policies");
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(req.tenant?.userRole).toBe("viewer");
  });

  it("leaves owners alone", async () => {
    const { req, next } = await run("user_owner", "POST", "/api/policies");
    expect(next).toHaveBeenCalled();
    expect(req.tenant?.userRole).toBe("owner");
  });

  it("checks the full mounted path, not just the router-relative path", async () => {
    const { res, next } = await run("user_viewer", "GET", "/settings/team", "/api");
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("auto-provisions unknown users as viewer, so a new sign-up can't write", async () => {
    let provisioned = false;
    tenantLookup.mockImplementation(async () =>
      provisioned ? { tenant: TENANT, role: "viewer" } : null
    );
    tenantUsersInsert.mockImplementationOnce(async () => {
      provisioned = true;
      return { error: null };
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const { req, res, next } = await run("user_new", "POST", "/api/servers");
    log.mockRestore();

    expect(tenantUsersInsert).toHaveBeenCalledWith(
      expect.objectContaining({ clerk_user_id: "user_new", role: "viewer" })
    );
    expect(req.tenant?.userRole).toBe("viewer");
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
