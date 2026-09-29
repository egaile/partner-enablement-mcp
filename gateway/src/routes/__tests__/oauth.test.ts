import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("../../auth/middleware.js", () => ({
  requireAuth: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock("../../db/queries/servers.js", () => ({
  getServerById: vi.fn(async () => ({
    id: "s1",
    tenantId: "t1",
    oauthTokenUrl: "https://auth.example.test/oauth/token",
  })),
  getServerByStateNonce: vi.fn(),
  updateServerStateNonce: vi.fn(),
}));
vi.mock("../../db/client.js", () => {
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    single: async () => ({
      data: { tenant_id: "t1", oauth_state_nonce: "nonce-1" },
      error: null,
    }),
  };
  return { getSupabaseClient: () => chain };
});
vi.mock("../../auth/server-oauth-provider.js", () => ({
  ServerOAuthProvider: class {
    static pendingAuthUrls = new Map();
    static codeVerifiers = new Map();
    redirectUrl = "https://gateway.example.test/api/oauth/callback/s1";
    async codeVerifier() {
      return "verifier";
    }
    async clientInformation() {
      return { client_id: "client-id" };
    }
  },
}));

const { createOAuthRouter } = await import("../oauth.js");

const realFetch = globalThis.fetch;
let http: HttpServer | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((r) => (http ? http.close(() => r()) : r()));
  http = undefined;
});

async function start(): Promise<string> {
  const app = express();
  app.use(
    createOAuthRouter({
      engines: new Map(),
      safeErrorMessage: (e: unknown) => String(e),
    } as never)
  );
  http = app.listen(0, "127.0.0.1");
  await new Promise((r) => http!.once("listening", r));
  return `http://127.0.0.1:${(http!.address() as AddressInfo).port}`;
}

describe("GET /api/oauth/callback/:serverId error responses", () => {
  it("returns the provider error as text/plain so it can't render as HTML", async () => {
    const base = await start();

    const res = await realFetch(
      `${base}/api/oauth/callback/s1?error=${encodeURIComponent("<script>alert(1)</script>")}`
    );

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await res.text()).toBe("OAuth error: <script>alert(1)</script>");
  });

  it("does not echo the token endpoint's error body to the browser", async () => {
    const base = await start();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).startsWith("https://auth.example.test/")) {
        return new Response("invalid_grant: secret-detail-from-idp", {
          status: 400,
        });
      }
      return realFetch(input, init);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await realFetch(
      `${base}/api/oauth/callback/s1?code=abc&state=nonce-1`
    );
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(text).toBe("Token exchange failed (HTTP 400). Check the gateway logs.");
    expect(text).not.toContain("secret-detail-from-idp");
  });
});
