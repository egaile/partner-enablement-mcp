import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, ConfigError } from "../loader.js";

describe("loadConfig", () => {
  let dir: string;
  let path: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "mcpshield-test-"));
    path = join(dir, "mcpshield.yaml");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads a minimal valid config", async () => {
    await writeFile(path, "");
    const cfg = await loadConfig({ path });
    expect(cfg.servers).toEqual([]);
    expect(cfg.policies).toEqual([]);
    expect(cfg.packs).toEqual([]);
    expect(cfg.audit.backend).toBe("sqlite");
    expect(cfg.server.port).toBe(4000);
  });

  it("loads a full example config", async () => {
    await writeFile(
      path,
      `
server:
  host: 127.0.0.1
  port: 5000
audit:
  backend: sqlite
  path: ./mcpshield.db
packs:
  - "@mcpshield/pack-saas"
servers:
  - id: atlassian
    transport: http
    url: https://mcp.atlassian.com/v1/sse
    auth: oauth2
policies:
  - name: Block Jira writes
    priority: 100
    conditions:
      tools: ["*create_issue*", "*update_issue*"]
    action: deny
  - name: Audit everything
    priority: 1000
    conditions:
      tools: ["*"]
    action: log_only
`
    );
    const cfg = await loadConfig({ path });
    expect(cfg.server.port).toBe(5000);
    expect(cfg.servers).toHaveLength(1);
    expect(cfg.servers[0].id).toBe("atlassian");
    expect(cfg.servers[0].transport).toBe("http");
    expect(cfg.servers[0].auth).toBe("oauth2");
    expect(cfg.policies).toHaveLength(2);
    expect(cfg.policies[0].action).toBe("deny");
    expect(cfg.packs).toEqual(["@mcpshield/pack-saas"]);
  });

  it("rejects unknown top-level keys", async () => {
    await writeFile(path, "unknownKey: foo\n");
    await expect(loadConfig({ path })).rejects.toThrow(ConfigError);
  });

  it("rejects invalid policy action", async () => {
    await writeFile(
      path,
      `
policies:
  - name: bad
    conditions:
      tools: ["*"]
    action: nuke_from_orbit
`
    );
    await expect(loadConfig({ path })).rejects.toThrow(/action/);
  });

  it("rejects http server missing url", async () => {
    await writeFile(
      path,
      `
servers:
  - id: broken
    transport: http
`
    );
    await expect(loadConfig({ path })).rejects.toThrow(/http servers require/);
  });

  it("rejects stdio server missing command", async () => {
    await writeFile(
      path,
      `
servers:
  - id: broken
    transport: stdio
`
    );
    await expect(loadConfig({ path })).rejects.toThrow(/stdio servers require/);
  });

  it("rejects malformed YAML", async () => {
    await writeFile(path, "not: valid: yaml: at: all:");
    await expect(loadConfig({ path })).rejects.toThrow(/Failed to parse/);
  });

  it("throws ConfigError when file does not exist", async () => {
    await expect(
      loadConfig({ path: join(dir, "missing.yaml") })
    ).rejects.toThrow(ConfigError);
  });
});
