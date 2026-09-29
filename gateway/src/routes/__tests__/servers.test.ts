import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { McpServerRecord } from "@mcpshield/gateway-core/storage";

const serverQueries = {
  getServersForTenant: vi.fn(),
  getServerById: vi.fn(),
  createServer: vi.fn(),
  updateServer: vi.fn(),
  deleteServer: vi.fn(),
};

vi.mock("../../auth/middleware.js", () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.tenant = {
      tenantId: "t1",
      tenantName: "Demo",
      userId: "user_owner",
      userRole: "owner",
      plan: "pro",
    };
    next();
  },
}));
vi.mock("../../db/queries/servers.js", () => serverQueries);
vi.mock("../../db/queries/billing.js", () => ({
  getServerCount: vi.fn(async () => 0),
}));

const { redactUrl, toPublicServer, createServersRouter } = await import("../servers.js");

function record(overrides: Partial<McpServerRecord> = {}): McpServerRecord {
  return {
    id: "s1",
    tenantId: "t1",
    name: "atlassian-rovo",
    transport: "http",
    command: null,
    args: null,
    url: "https://mcp.example.com/v1/sse",
    env: { JIRA_TOKEN: "env-secret" },
    authHeaders: { Authorization: "Bearer header-secret" },
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    authType: "oauth2",
    oauthClientId: "client-id",
    oauthClientSecret: "client-secret",
    oauthRefreshToken: "refresh-secret",
    oauthAccessToken: "access-secret",
    oauthTokenExpiresAt: "2026-01-02T00:00:00Z",
    oauthTokenUrl: "https://auth.example.com/token",
    oauthAuthorizeUrl: "https://auth.example.com/authorize",
    oauthScopes: ["read:jira-work"],
    oauthCodeVerifier: "verifier-secret",
    oauthStateNonce: "nonce-secret",
    ...overrides,
  };
}

const SECRETS = [
  "env-secret",
  "header-secret",
  "client-secret",
  "refresh-secret",
  "access-secret",
  "verifier-secret",
  "nonce-secret",
];

describe("toPublicServer", () => {
  it("drops OAuth secrets and redacts env/header values but keeps their keys", () => {
    const pub = toPublicServer(record());

    const serialized = JSON.stringify(pub);
    for (const secret of SECRETS) {
      expect(serialized).not.toContain(secret);
    }
    for (const field of [
      "oauthClientSecret",
      "oauthAccessToken",
      "oauthRefreshToken",
      "oauthCodeVerifier",
      "oauthStateNonce",
    ]) {
      expect(pub).not.toHaveProperty(field);
    }
    expect(pub.env).toEqual({ JIRA_TOKEN: "[redacted]" });
    expect(pub.authHeaders).toEqual({ Authorization: "[redacted]" });
    // Non-secret fields pass through for the UI.
    expect(pub).toMatchObject({
      id: "s1",
      name: "atlassian-rovo",
      oauthClientId: "client-id",
      oauthScopes: ["read:jira-work"],
      oauthTokenExpiresAt: "2026-01-02T00:00:00Z",
    });
  });

  it("keeps null env/authHeaders as null", () => {
    const pub = toPublicServer(
      record({
        env: null,
        authHeaders: null,
        oauthAccessToken: null,
        oauthRefreshToken: null,
      })
    );
    expect(pub.env).toBeNull();
    expect(pub.authHeaders).toBeNull();
  });
});

describe("servers router responses", () => {
  let http: HttpServer | undefined;

  afterEach(async () => {
    await new Promise<void>((r) => (http ? http.close(() => r()) : r()));
    http = undefined;
  });

  async function start(): Promise<string> {
    const app = express();
    app.use(express.json());
    app.use(
      createServersRouter({
        safeErrorMessage: (e: unknown) => String(e),
      } as never)
    );
    http = app.listen(0, "127.0.0.1");
    await new Promise((r) => http!.once("listening", r));
    return `http://127.0.0.1:${(http!.address() as AddressInfo).port}`;
  }

  it("never returns secrets from list, create, or update", async () => {
    serverQueries.getServersForTenant.mockResolvedValue([record()]);
    serverQueries.createServer.mockResolvedValue(record());
    serverQueries.updateServer.mockResolvedValue(record());
    const base = await start();

    const list = await fetch(`${base}/api/servers`);
    const created = await fetch(`${base}/api/servers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "atlassian-rovo",
        transport: "http",
        url: "https://mcp.example.com/v1/sse",
      }),
    });
    const updated = await fetch(`${base}/api/servers/s1`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    expect(list.status).toBe(200);
    expect(created.status).toBe(201);
    expect(updated.status).toBe(200);
    for (const res of [list, created, updated]) {
      const text = await res.text();
      for (const secret of SECRETS) {
        expect(text).not.toContain(secret);
      }
    }
  });
});

describe("redactUrl", () => {
  it.each([
    ["https://mcp.example.com/v1/sse", "https://mcp.example.com/v1/sse"],
    ["https://user:secret@mcp.example.com/v1", "https://mcp.example.com/v1"],
    ["https://mcp.example.com/v1?token=abc&org=x", "https://mcp.example.com/v1?token=%5Bredacted%5D&org=%5Bredacted%5D"],
    ["https://mcp.example.com/v1#key=abc", "https://mcp.example.com/v1"],
    ["not a url", "[redacted]"],
  ])("%s", (input, expected) => {
    expect(redactUrl(input)).toBe(expected);
  });

  it("keeps null", () => {
    expect(redactUrl(null)).toBeNull();
  });
});

describe("toPublicServer allowlist", () => {
  it("drops stdio command/args and fields it doesn't know about", () => {
    const pub = toPublicServer({
      ...record({}),
      transport: "stdio",
      command: "npx",
      args: ["server", "--api-key=sk_live_123"],
      url: "https://x.io/mcp?api_key=sk_live_456",
      futureSecretColumn: "should-not-leak",
    } as never) as Record<string, unknown>;
    expect(pub).not.toHaveProperty("command");
    expect(pub).not.toHaveProperty("args");
    expect(pub).not.toHaveProperty("futureSecretColumn");
    expect(JSON.stringify(pub)).not.toContain("sk_live");
  });
});
