import { describe, it, expect, vi } from "vitest";
import {
  chainAlertSinks,
  noopAlertSink,
  noopBillingGuard,
  type AlertSink,
} from "../ports.js";

const TENANT = "00000000-0000-0000-0000-000000000001";

function spySink(behavior?: {
  fireInjection?: () => Promise<void>;
  fireServerError?: () => Promise<void>;
}): AlertSink & Record<string, ReturnType<typeof vi.fn>> {
  return {
    fireInjection: vi
      .fn()
      .mockImplementation(behavior?.fireInjection ?? (async () => {})),
    fireDrift: vi.fn().mockResolvedValue(undefined),
    firePolicyViolation: vi.fn().mockResolvedValue(undefined),
    fireRateLimit: vi.fn().mockResolvedValue(undefined),
    fireServerError: vi
      .fn()
      .mockImplementation(behavior?.fireServerError ?? (async () => {})),
  };
}

describe("noopAlertSink", () => {
  it("resolves on every method", async () => {
    await expect(
      noopAlertSink.fireInjection(
        TENANT,
        {
          clean: true,
          indicators: [],
          highestSeverity: null,
          scanDurationMs: 0,
        },
        { serverId: "s", toolName: "t", correlationId: "c" }
      )
    ).resolves.toBeUndefined();
    await expect(
      noopAlertSink.fireServerError(TENANT, {
        serverId: "s",
        serverName: "x",
        errorMessage: "e",
        errorType: "t",
      })
    ).resolves.toBeUndefined();
  });
});

describe("noopBillingGuard", () => {
  it("always allows", async () => {
    await expect(noopBillingGuard.check(TENANT)).resolves.toEqual({
      allowed: true,
    });
  });
});

describe("chainAlertSinks", () => {
  it("fans out to every sink", async () => {
    const a = spySink();
    const b = spySink();
    const chained = chainAlertSinks(a, b);

    await chained.fireInjection(
      TENANT,
      {
        clean: false,
        indicators: [],
        highestSeverity: "critical",
        scanDurationMs: 0,
      },
      { serverId: "s", toolName: "t", correlationId: "c" }
    );

    expect(a.fireInjection).toHaveBeenCalledTimes(1);
    expect(b.fireInjection).toHaveBeenCalledTimes(1);
  });

  it("one sink throwing does not block the others", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = spySink({
      fireServerError: () => Promise.reject(new Error("kaboom")),
    });
    const working = spySink();
    const chained = chainAlertSinks(broken, working);

    await chained.fireServerError(TENANT, {
      serverId: "s",
      serverName: "n",
      errorMessage: "e",
      errorType: "t",
    });

    expect(broken.fireServerError).toHaveBeenCalledTimes(1);
    expect(working.fireServerError).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("with zero sinks: every method is a no-op", async () => {
    const chained = chainAlertSinks();
    await expect(
      chained.fireDrift(
        TENANT,
        {
          drifted: false,
          toolName: "t",
          severity: null,
          changes: [],
          currentHash: "h",
          approvedHash: null,
        },
        { serverId: "s" }
      )
    ).resolves.toBeUndefined();
  });
});
