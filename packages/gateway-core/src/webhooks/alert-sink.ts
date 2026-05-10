/**
 * WebhookAlertSink — adapts WebhookDispatcher to the AlertSink port so
 * proxy alerts trigger webhook deliveries automatically.
 *
 * Event names follow the `ALERT_EVENTS` enum. Payloads carry the full
 * alert context (server, tool, correlation id, severity, etc.) for
 * subscriber filtering.
 *
 * Wire as part of a `chainAlertSinks(...)` composition when you also
 * want alerts persisted (cloud), or as the sole sink for self-host.
 */

import { ALERT_EVENTS } from "../schemas/index.js";
import type { AlertSink } from "../proxy/ports.js";
import type { ThreatScanResult } from "../security/types.js";
import type { DriftResult } from "../monitor/types.js";
import type { WebhookDispatcher } from "./dispatcher.js";

export class WebhookAlertSink implements AlertSink {
  constructor(private readonly dispatcher: WebhookDispatcher) {}

  async fireInjection(
    tenantId: string,
    scan: ThreatScanResult,
    context: { serverId: string; toolName: string; correlationId: string }
  ): Promise<void> {
    await this.dispatcher.dispatch(tenantId, ALERT_EVENTS.injectionDetected, {
      ...context,
      severity: scan.highestSeverity,
      indicatorCount: scan.indicators.length,
      indicators: scan.indicators.map((i) => ({
        strategy: i.strategy,
        severity: i.severity,
        description: i.description,
        fieldPath: i.fieldPath,
      })),
    });
  }

  async fireDrift(
    tenantId: string,
    drift: DriftResult,
    context: { serverId: string; correlationId?: string }
  ): Promise<void> {
    await this.dispatcher.dispatch(tenantId, ALERT_EVENTS.toolDrift, {
      ...context,
      toolName: drift.toolName,
      severity: drift.severity,
      changes: drift.changes,
      currentHash: drift.currentHash,
      approvedHash: drift.approvedHash,
    });
  }

  async firePolicyViolation(
    tenantId: string,
    context: {
      serverId: string;
      toolName: string;
      correlationId: string;
      ruleName: string;
      action: string;
    }
  ): Promise<void> {
    await this.dispatcher.dispatch(
      tenantId,
      ALERT_EVENTS.policyViolation,
      context
    );
  }

  async fireRateLimit(
    tenantId: string,
    context: {
      serverId: string;
      toolName: string;
      correlationId: string;
      userId: string;
      currentRate: number;
      limitPerMinute: number;
    }
  ): Promise<void> {
    await this.dispatcher.dispatch(
      tenantId,
      ALERT_EVENTS.rateLimitExceeded,
      context
    );
  }

  async fireServerError(
    tenantId: string,
    context: {
      serverId: string;
      serverName: string;
      correlationId?: string;
      errorMessage: string;
      errorType: string;
    }
  ): Promise<void> {
    await this.dispatcher.dispatch(
      tenantId,
      ALERT_EVENTS.serverError,
      context
    );
  }
}
