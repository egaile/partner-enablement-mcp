/**
 * Ports — interfaces the proxy depends on but does not implement.
 *
 * The cloud control plane injects concrete adapters (CloudAlertSink,
 * CloudBillingGuard, CloudOAuthProviderFactory). Self-host deployments
 * leave them undefined; the proxy short-circuits to safe defaults.
 *
 * Keeping these as small, intent-named interfaces (rather than re-exporting
 * cloud classes) is what lets `gateway-core` stay free of cloud imports.
 */

import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { AuditEntry } from "../schemas/index.js";
import type { ThreatScanResult } from "../security/types.js";
import type { DriftResult } from "../monitor/types.js";
import type { McpServerRecord } from "../storage/types.js";

/**
 * Persists audit entries.
 *
 * `BaseAuditLogger` satisfies this directly; cloud's `AuditLogger` overrides
 * `record()` to call its Atlassian-aware `logEnriched()` instead.
 */
export interface AuditRecorder {
  record(entry: AuditEntry, toolParams?: Record<string, unknown>): void;
}

/**
 * Side-channel for security events: alerts, drift, policy violations.
 *
 * Implementations should never throw — the interceptor fires alerts
 * fire-and-forget. A failing alert must never block a tool call.
 */
export interface AlertSink {
  fireInjection(
    tenantId: string,
    scan: ThreatScanResult,
    context: { serverId: string; toolName: string; correlationId: string }
  ): Promise<void>;
  fireDrift(
    tenantId: string,
    drift: DriftResult,
    context: { serverId: string; correlationId?: string }
  ): Promise<void>;
  firePolicyViolation(
    tenantId: string,
    context: {
      serverId: string;
      toolName: string;
      correlationId: string;
      ruleName: string;
      action: string;
    }
  ): Promise<void>;
  fireRateLimit(
    tenantId: string,
    context: {
      serverId: string;
      toolName: string;
      correlationId: string;
      userId: string;
      currentRate: number;
      limitPerMinute: number;
    }
  ): Promise<void>;
  fireServerError(
    tenantId: string,
    context: {
      serverId: string;
      serverName: string;
      correlationId?: string;
      errorMessage: string;
      errorType: string;
    }
  ): Promise<void>;
}

/** No-op sink used when no alerting backend is wired up. */
export const noopAlertSink: AlertSink = {
  async fireInjection() {},
  async fireDrift() {},
  async firePolicyViolation() {},
  async fireRateLimit() {},
  async fireServerError() {},
};

/**
 * Compose multiple AlertSinks into one. Each method fans out to every
 * underlying sink in parallel; individual failures are caught and logged
 * so one slow / broken sink can't drop alerts for the others.
 *
 * Useful pattern: `chainAlertSinks(cloudAlertSink, webhookAlertSink)` —
 * persist the alert AND deliver webhooks on the same event.
 */
export function chainAlertSinks(...sinks: AlertSink[]): AlertSink {
  const fanOut = async (
    name: string,
    invoke: (sink: AlertSink) => Promise<void>
  ): Promise<void> => {
    const results = await Promise.allSettled(sinks.map(invoke));
    for (const r of results) {
      if (r.status === "rejected") {
        console.error(`[alert] ${name} sink failed:`, r.reason);
      }
    }
  };

  return {
    fireInjection: (t, s, c) =>
      fanOut("fireInjection", (sink) => sink.fireInjection(t, s, c)),
    fireDrift: (t, d, c) =>
      fanOut("fireDrift", (sink) => sink.fireDrift(t, d, c)),
    firePolicyViolation: (t, c) =>
      fanOut("firePolicyViolation", (sink) =>
        sink.firePolicyViolation(t, c)
      ),
    fireRateLimit: (t, c) =>
      fanOut("fireRateLimit", (sink) => sink.fireRateLimit(t, c)),
    fireServerError: (t, c) =>
      fanOut("fireServerError", (sink) => sink.fireServerError(t, c)),
  };
}

/**
 * Pre-flight billing check (cloud usage limit enforcement).
 *
 * Returning `allowed: false` causes the interceptor to deny the call with
 * the supplied `reason` as the user-facing message.
 */
export interface BillingGuard {
  check(tenantId: string): Promise<{ allowed: boolean; reason?: string }>;
}

/** Always-allow guard used by self-host deployments. */
export const noopBillingGuard: BillingGuard = {
  async check() {
    return { allowed: true };
  },
};

/**
 * Builds an MCP SDK OAuth provider for a given downstream server record.
 *
 * Self-host: omit and rely on static auth headers for HTTP servers.
 * Cloud: provide a factory that returns `ServerOAuthProvider` instances
 * backed by the cloud's persisted OAuth state.
 */
export interface OAuthProviderFactory {
  forServer(server: McpServerRecord): OAuthClientProvider | null;
}
