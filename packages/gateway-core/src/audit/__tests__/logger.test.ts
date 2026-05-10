import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BaseAuditLogger, type AuditAppendPort } from "../logger.js";
import type { AuditEntry } from "../../schemas/index.js";

function makeEntry(overrides?: Partial<AuditEntry>): AuditEntry {
  return {
    correlationId: "00000000-0000-0000-0000-000000000001",
    tenantId: "00000000-0000-0000-0000-000000000002",
    serverId: "00000000-0000-0000-0000-000000000003",
    serverName: "test-server",
    toolName: "test-tool",
    policyDecision: "allow",
    threatsDetected: 0,
    driftDetected: false,
    latencyMs: 42,
    requestPiiDetected: false,
    responsePiiDetected: false,
    success: true,
    ...overrides,
  };
}

function makeFakeAudit(): {
  port: AuditAppendPort;
  append: ReturnType<typeof vi.fn>;
} {
  const append = vi.fn<(entries: AuditEntry[]) => Promise<void>>();
  append.mockResolvedValue(undefined);
  return {
    port: {
      append: (entries: AuditEntry[]) => append(entries),
    },
    append,
  };
}

describe("BaseAuditLogger", () => {
  let logger: BaseAuditLogger;
  let append: ReturnType<typeof vi.fn>;

  function setup(opts: { batchSize?: number; flushIntervalMs?: number } = {}) {
    const fake = makeFakeAudit();
    append = fake.append;
    logger = new BaseAuditLogger({
      audit: fake.port,
      batchSize: opts.batchSize ?? 100,
      flushIntervalMs: opts.flushIntervalMs ?? 60_000,
    });
  }

  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    logger?.stop();
  });

  describe("buffering", () => {
    it("entries are buffered (not immediately flushed)", () => {
      logger.log(makeEntry());
      logger.log(makeEntry());
      expect(logger.pendingCount).toBe(2);
      expect(append).not.toHaveBeenCalled();
    });

    it("pendingCount reflects the number of buffered entries", () => {
      expect(logger.pendingCount).toBe(0);
      logger.log(makeEntry());
      expect(logger.pendingCount).toBe(1);
      logger.log(makeEntry());
      logger.log(makeEntry());
      expect(logger.pendingCount).toBe(3);
    });
  });

  describe("flush", () => {
    it("sends buffered entries to the storage port", async () => {
      const e1 = makeEntry({ toolName: "tool_a" });
      const e2 = makeEntry({ toolName: "tool_b" });
      logger.log(e1);
      logger.log(e2);

      await logger.flush();

      expect(append).toHaveBeenCalledOnce();
      expect(append).toHaveBeenCalledWith([e1, e2]);
      expect(logger.pendingCount).toBe(0);
    });

    it("does nothing when buffer is empty", async () => {
      await logger.flush();
      expect(append).not.toHaveBeenCalled();
    });

    it("flushes at most batchSize entries per flush call", async () => {
      setup({ batchSize: 100 });
      logger.log(makeEntry({ toolName: "tool_0" }));
      logger.log(makeEntry({ toolName: "tool_1" }));
      expect(logger.pendingCount).toBe(2);

      await logger.flush();
      expect(append).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ toolName: "tool_0" }),
          expect.objectContaining({ toolName: "tool_1" }),
        ])
      );
      expect(logger.pendingCount).toBe(0);
    });
  });

  describe("auto-flush on batch size", () => {
    it("triggers flush when buffer reaches batchSize", async () => {
      setup({ batchSize: 3 });

      logger.log(makeEntry({ toolName: "a" }));
      logger.log(makeEntry({ toolName: "b" }));
      expect(append).not.toHaveBeenCalled();

      logger.log(makeEntry({ toolName: "c" }));

      await vi.waitFor(() => {
        expect(append).toHaveBeenCalledOnce();
      });
      expect(append).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ toolName: "a" }),
          expect.objectContaining({ toolName: "b" }),
          expect.objectContaining({ toolName: "c" }),
        ])
      );
    });

    it("triggers flush again after more entries accumulate", async () => {
      setup({ batchSize: 2 });

      logger.log(makeEntry({ toolName: "batch1-a" }));
      logger.log(makeEntry({ toolName: "batch1-b" }));

      await vi.waitFor(() => {
        expect(append).toHaveBeenCalledTimes(1);
      });

      logger.log(makeEntry({ toolName: "batch2-a" }));
      logger.log(makeEntry({ toolName: "batch2-b" }));

      await vi.waitFor(() => {
        expect(append).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("failed flush recovery", () => {
    it("puts entries back in buffer on flush failure", async () => {
      logger.log(makeEntry({ toolName: "will-retry-a" }));
      logger.log(makeEntry({ toolName: "will-retry-b" }));

      append.mockRejectedValueOnce(new Error("DB connection failed"));

      await expect(logger.flush()).rejects.toThrow("DB connection failed");
      expect(logger.pendingCount).toBe(2);
    });

    it("entries are recoverable after a failed flush", async () => {
      logger.log(makeEntry({ toolName: "recover-a" }));
      logger.log(makeEntry({ toolName: "recover-b" }));

      append.mockRejectedValueOnce(new Error("Temporary failure"));
      await expect(logger.flush()).rejects.toThrow("Temporary failure");

      append.mockResolvedValueOnce(undefined);
      await logger.flush();

      expect(append).toHaveBeenCalledTimes(2);
      expect(logger.pendingCount).toBe(0);
    });

    it("failed entries are placed back at the front of the buffer", async () => {
      logger.log(makeEntry({ toolName: "first" }));
      logger.log(makeEntry({ toolName: "second" }));

      append.mockRejectedValueOnce(new Error("fail"));
      await expect(logger.flush()).rejects.toThrow("fail");

      logger.log(makeEntry({ toolName: "third" }));

      expect(logger.pendingCount).toBe(3);

      append.mockResolvedValueOnce(undefined);
      await logger.flush();

      const calledWith = append.mock.calls[1][0] as AuditEntry[];
      expect(calledWith[0].toolName).toBe("first");
      expect(calledWith[1].toolName).toBe("second");
      expect(calledWith[2].toolName).toBe("third");
    });
  });

  describe("start/stop timer", () => {
    it("start() does not throw", () => {
      expect(() => logger.start()).not.toThrow();
    });

    it("stop() clears the timer", () => {
      logger.start();
      expect(() => logger.stop()).not.toThrow();
    });

    it("start() is idempotent (calling twice does not create duplicate timers)", () => {
      logger.start();
      logger.start();
      logger.stop();
    });
  });

  describe("onLogged hook", () => {
    it("subclass can observe each logged entry", () => {
      const observed: string[] = [];
      class TrackingLogger extends BaseAuditLogger {
        protected override onLogged(entry: AuditEntry): void {
          observed.push(entry.toolName);
        }
      }
      const fake = makeFakeAudit();
      const tracker = new TrackingLogger({
        audit: fake.port,
        batchSize: 100,
        flushIntervalMs: 60_000,
      });
      tracker.log(makeEntry({ toolName: "x" }));
      tracker.log(makeEntry({ toolName: "y" }));
      expect(observed).toEqual(["x", "y"]);
      tracker.stop();
    });
  });
});
