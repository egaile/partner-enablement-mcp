import {
  createAlert,
  type AlertRecord,
} from "../db/queries/alerts.js";
import type { AlertType, AlertSeverity } from "../schemas/index.js";
import type { ThreatScanResult } from "../security/types.js";
import type { DriftResult } from "../monitor/types.js";

export class AlertEngine {
  async fireInjectionAlert(
    tenantId: string,
    scanResult: ThreatScanResult,
    context: {
      serverId: string;
      toolName: string;
      correlationId: string;
    }
  ): Promise<AlertRecord> {
    const severity = this.mapThreatSeverity(
      scanResult.highestSeverity ?? "info"
    );
    return createAlert({
      tenantId,
      type: "injection_detected" as AlertType,
      severity,
      title: `Prompt injection detected in ${context.toolName}`,
      details: {
        indicators: scanResult.indicators.map((i) => ({
          strategy: i.strategy,
          severity: i.severity,
          description: i.description,
          fieldPath: i.fieldPath,
        })),
        scanDurationMs: scanResult.scanDurationMs,
      },
      serverId: context.serverId,
      toolName: context.toolName,
      correlationId: context.correlationId,
    });
  }

  async fireDriftAlert(
    tenantId: string,
    drift: DriftResult,
    context: {
      serverId: string;
      correlationId?: string;
    }
  ): Promise<AlertRecord> {
    const severity = this.mapDriftSeverity(drift.severity);
    return createAlert({
      tenantId,
      type: "tool_drift" as AlertType,
      severity,
      title: `Tool definition drift: ${drift.toolName}`,
      details: {
        changes: drift.changes,
        currentHash: drift.currentHash,
        approvedHash: drift.approvedHash,
      },
      serverId: context.serverId,
      toolName: drift.toolName,
      correlationId: context.correlationId,
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
  ): Promise<AlertRecord> {
    return createAlert({
      tenantId,
      type: "policy_violation" as AlertType,
      severity: "medium" as AlertSeverity,
      title: `Policy "${context.ruleName}" denied ${context.toolName}`,
      details: {
        ruleName: context.ruleName,
        action: context.action,
      },
      serverId: context.serverId,
      toolName: context.toolName,
      correlationId: context.correlationId,
    });
  }

  private mapThreatSeverity(
    severity: string
  ): AlertSeverity {
    switch (severity) {
      case "critical":
        return "critical";
      case "high":
        return "high";
      case "medium":
        return "medium";
      default:
        return "low";
    }
  }

  private mapDriftSeverity(
    severity: DriftResult["severity"]
  ): AlertSeverity {
    switch (severity) {
      case "critical":
        return "critical";
      case "functional":
        return "high";
      case "cosmetic":
        return "medium";
      default:
        return "low";
    }
  }
}
