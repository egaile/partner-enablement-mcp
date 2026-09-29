import { describe, expect, it } from "vitest";
import { ConnectionManager } from "../connection-manager.js";
import type { McpServerRecord } from "../../storage/types.js";

const stdioServer = {
  id: "s1",
  tenantId: "t1",
  name: "local-tool",
  transport: "stdio",
  command: "node",
  args: ["-e", "process.exit(1)"],
  url: null,
  env: null,
  authHeaders: null,
  enabled: true,
} as unknown as McpServerRecord;

describe("ConnectionManager allowStdio", () => {
  it("refuses to spawn a stdio server when disabled", async () => {
    const cm = new ConnectionManager({ allowStdio: false });
    await expect(cm.connect(stdioServer)).rejects.toThrow(/stdio.*disabled/);
  });

  it("still validates stdio records when allowed (self-host default)", async () => {
    const cm = new ConnectionManager();
    await expect(
      cm.connect({ ...stdioServer, command: null } as unknown as McpServerRecord)
    ).rejects.toThrow(/missing command/);
  });
});
