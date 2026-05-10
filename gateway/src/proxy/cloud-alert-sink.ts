/**
 * CloudAlertSink — adapts the cloud's `AlertEngine` (which writes to Supabase
 * + dispatches webhooks) to the `AlertSink` port consumed by gateway-core's
 * proxy subsystem.
 *
 * Method names are normalized: the engine has `fireInjectionAlert` /
 * `fireDriftAlert`; the port uses the shorter `fireInjection` / `fireDrift`.
 */

import type {
  AlertSink,
} from "@mcpshield/gateway-core/proxy";
import type { ThreatScanResult } from "@mcpshield/gateway-core/security";
import type { DriftResult } from "@mcpshield/gateway-core/monitor";
import type { AlertEngine } from "../alerts/engine.js";

export class CloudAlertSink implements AlertSink {
  constructor(private readonly engine: AlertEngine) {}

  async fireInjection(
    tenantId: string,
    scan: ThreatScanResult,
    context: { serverId: string; toolName: string; correlationId: string }
  ): Promise<void> {
    await this.engine.fireInjectionAlert(tenantId, scan, context);
  }

  async fireDrift(
    tenantId: string,
    drift: DriftResult,
    context: { serverId: string; correlationId?: string }
  ): Promise<void> {
    await this.engine.fireDriftAlert(tenantId, drift, context);
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
    await this.engine.firePolicyViolation(tenantId, context);
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
    await this.engine.fireRateLimitExceeded(tenantId, context);
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
    await this.engine.fireServerError(tenantId, context);
  }
}
