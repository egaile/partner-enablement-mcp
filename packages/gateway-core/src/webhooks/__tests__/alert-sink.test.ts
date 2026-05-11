import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookAlertSink } from "../alert-sink.js";
import { WebhookDispatcher } from "../dispatcher.js";
import { ALERT_EVENTS } from "../../schemas/index.js";
import type { WebhooksPort } from "../dispatcher.js";

const TENANT = "00000000-0000-0000-0000-000000000001";

function emptyPort(): WebhooksPort {
  return {
    async listByEvent() {
      return [];
    },
    async get() {
      return null;
    },
  };
}

describe("WebhookAlertSink", () => {
  let dispatcher: WebhookDispatcher;
  let dispatch: ReturnType<typeof vi.fn>;
  let sink: WebhookAlertSink;

  beforeEach(() => {
    dispatcher = new WebhookDispatcher({ webhooks: emptyPort() });
    dispatch = vi.fn().mockResolvedValue(undefined);
    // Stub dispatch so we only test the translation layer here, not delivery.
    (dispatcher as unknown as { dispatch: typeof dispatch }).dispatch =
      dispatch;
    sink = new WebhookAlertSink(dispatcher);
  });

  it("fireInjection → injection_detected event with scan summary", async () => {
    await sink.fireInjection(
      TENANT,
      {
        clean: false,
        indicators: [
          {
            strategy: "pattern-match",
            severity: "critical",
            description: "ignore-previous",
            fieldPath: "params.prompt",
          },
        ],
        highestSeverity: "critical",
        scanDurationMs: 3,
      },
      { serverId: "s-1", toolName: "deleteX", correlationId: "c-1" }
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    const [tenantId, event, payload] = dispatch.mock.calls[0];
    expect(tenantId).toBe(TENANT);
    expect(event).toBe(ALERT_EVENTS.injectionDetected);
    expect(payload.severity).toBe("critical");
    expect(payload.indicatorCount).toBe(1);
    expect(payload.indicators[0].strategy).toBe("pattern-match");
    expect(payload.toolName).toBe("deleteX");
  });

  it("fireDrift → tool_drift event with diff summary", async () => {
    await sink.fireDrift(
      TENANT,
      {
        drifted: true,
        toolName: "deleteX",
        severity: "critical",
        changes: ["parameter added: forceful"],
        currentHash: "hashA",
        approvedHash: "hashB",
      },
      { serverId: "s-1", correlationId: "c-2" }
    );

    const [, event, payload] = dispatch.mock.calls[0];
    expect(event).toBe(ALERT_EVENTS.toolDrift);
    expect(payload.severity).toBe("critical");
    expect(payload.changes).toContain("parameter added: forceful");
    expect(payload.currentHash).toBe("hashA");
    expect(payload.approvedHash).toBe("hashB");
  });

  it("firePolicyViolation → policy_violation event", async () => {
    await sink.firePolicyViolation(TENANT, {
      serverId: "s-1",
      toolName: "deleteX",
      correlationId: "c-3",
      ruleName: "no-destructive-writes",
      action: "deny",
    });

    const [, event, payload] = dispatch.mock.calls[0];
    expect(event).toBe(ALERT_EVENTS.policyViolation);
    expect(payload.ruleName).toBe("no-destructive-writes");
  });

  it("fireRateLimit → rate_limit_exceeded event", async () => {
    await sink.fireRateLimit(TENANT, {
      serverId: "s-1",
      toolName: "deleteX",
      correlationId: "c-4",
      userId: "alice",
      currentRate: 11,
      limitPerMinute: 10,
    });

    const [, event, payload] = dispatch.mock.calls[0];
    expect(event).toBe(ALERT_EVENTS.rateLimitExceeded);
    expect(payload.currentRate).toBe(11);
    expect(payload.limitPerMinute).toBe(10);
  });

  it("fireServerError → server_error event", async () => {
    await sink.fireServerError(TENANT, {
      serverId: "s-1",
      serverName: "atlassian",
      correlationId: "c-5",
      errorMessage: "connect refused",
      errorType: "connection_failure",
    });

    const [, event, payload] = dispatch.mock.calls[0];
    expect(event).toBe(ALERT_EVENTS.serverError);
    expect(payload.errorMessage).toBe("connect refused");
    expect(payload.errorType).toBe("connection_failure");
  });
});
