import { afterEach, describe, expect, it, vi } from "vitest";
import { demoUserIds, isViewerAllowed, normalizePath } from "../viewer-access.js";

describe("isViewerAllowed", () => {
  it.each([
    ["GET", "/api/servers"],
    ["GET", "/api/policies"],
    ["GET", "/api/audit"],
    ["GET", "/api/audit/metrics"],
    ["GET", "/api/alerts"],
    ["GET", "/api/approvals"],
    ["GET", "/api/dashboard/overview"],
    ["GET", "/api/me"],
    ["GET", "/api/servers/abc/health"],
    ["GET", "/api/servers/abc/snapshots"],
    ["GET", "/api/servers/abc/oauth/status"],
    ["GET", "/api/billing/usage"],
    ["HEAD", "/api/servers"],
    ["GET", "/API/Servers/"],
    ["POST", "/api/policies/simulate"],
  ])("allows %s %s", (method, path) => {
    expect(isViewerAllowed(method, path)).toBe(true);
  });

  it.each([
    ["POST", "/mcp"],
    ["GET", "/mcp"],
    ["GET", "/MCP"],
    ["GET", "/mcp/"],
    ["POST", "/api/servers"],
    ["PUT", "/api/servers/abc"],
    ["DELETE", "/api/servers/abc"],
    ["POST", "/api/policies"],
    ["DELETE", "/api/policies/abc"],
    ["POST", "/api/approvals/abc/approve"],
    ["POST", "/api/alerts/abc/acknowledge"],
    ["POST", "/api/servers/abc/snapshots/def/approve"],
    ["POST", "/api/templates/atlassian/tpl/apply"],
    ["POST", "/api/webhooks"],
    ["GET", "/api/webhooks"],
    ["POST", "/api/billing/checkout"],
    ["GET", "/api/settings/api-keys"],
    ["GET", "/api/settings/team"],
    ["GET", "/api/servers/abc/oauth/authorize"],
    ["GET", "/api/billing/history"],
    ["GET", "/api/demo/audit-trail"],
    // Express routing ignores case and a trailing slash; the check must too.
    ["GET", "/API/SETTINGS/API-KEYS"],
    ["GET", "/Api/Settings/team"],
    ["GET", "/api/billing/history/"],
    ["GET", "/api/servers/abc/oauth/authorize/"],
    ["GET", "/api/servers/abc/OAuth/authorize"],
    ["GET", "/api//webhooks"],
    ["GET", "/api/some-future-route"],
  ])("blocks %s %s", (method, path) => {
    expect(isViewerAllowed(method, path)).toBe(false);
  });
});

describe("normalizePath", () => {
  it.each([
    ["/API/Settings/team/", "/api/settings/team"],
    ["/api//webhooks//", "/api/webhooks"],
    ["/", "/"],
    ["", "/"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe("demoUserIds", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses a comma-separated list", () => {
    vi.stubEnv("DEMO_CLERK_USER_IDS", "user_a, user_b,,");
    vi.stubEnv("DEMO_CLERK_USER_ID", "");
    expect([...demoUserIds()]).toEqual(["user_a", "user_b"]);
  });

  it("also accepts the dashboard's DEMO_CLERK_USER_ID name", () => {
    vi.stubEnv("DEMO_CLERK_USER_IDS", "");
    vi.stubEnv("DEMO_CLERK_USER_ID", "user_demo");
    expect([...demoUserIds()]).toEqual(["user_demo"]);
  });

  it("is empty when unset", () => {
    vi.stubEnv("DEMO_CLERK_USER_IDS", "");
    vi.stubEnv("DEMO_CLERK_USER_ID", "");
    expect(demoUserIds().size).toBe(0);
  });
});
