import { describe, expect, it } from "vitest";
import {
  RegisterServerSchema,
  SIMULATE_MAX_PARAMS_BYTES,
  SimulatePolicySchema,
  UpdateServerSchema,
} from "../index.js";

describe("hosted server schemas", () => {
  it("accepts an HTTP server", () => {
    const parsed = RegisterServerSchema.safeParse({
      name: "atlassian-rovo",
      transport: "http",
      url: "https://mcp.atlassian.com/v1/sse",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects stdio, which would run a command inside the shared gateway", () => {
    // Otherwise valid, so the only thing that can fail is the transport.
    const parsed = RegisterServerSchema.safeParse({
      name: "evil",
      transport: "stdio",
      url: "https://example.com/mcp",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((i) => i.path.join("."))).toEqual(["transport"]);
  });

  it("requires a URL", () => {
    expect(
      RegisterServerSchema.safeParse({ name: "no-url", transport: "http" }).success
    ).toBe(false);
  });

  it("rejects switching an existing server to stdio", () => {
    expect(UpdateServerSchema.safeParse({ transport: "stdio" }).success).toBe(false);
    expect(UpdateServerSchema.safeParse({ command: "sh" }).success).toBe(false);
  });
});

describe("SimulatePolicySchema params cap", () => {
  const base = { serverName: "s", toolName: "t" };
  // JSON.stringify({ x: "..." }) adds 8 bytes around the string.
  const fits = "a".repeat(SIMULATE_MAX_PARAMS_BYTES - 8);

  it("accepts params up to the limit", () => {
    expect(SimulatePolicySchema.safeParse({ ...base, params: { x: fits } }).success).toBe(true);
  });

  it("rejects params over the limit", () => {
    expect(
      SimulatePolicySchema.safeParse({ ...base, params: { x: fits + "a" } }).success
    ).toBe(false);
  });

  it("counts bytes, not characters", () => {
    const multibyte = "é".repeat(Math.ceil(SIMULATE_MAX_PARAMS_BYTES / 2));
    expect(multibyte.length).toBeLessThan(SIMULATE_MAX_PARAMS_BYTES);
    expect(
      SimulatePolicySchema.safeParse({ ...base, params: { x: multibyte } }).success
    ).toBe(false);
  });

  it("allows omitting params", () => {
    expect(SimulatePolicySchema.safeParse(base).success).toBe(true);
  });
});

