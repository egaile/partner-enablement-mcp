import { generateCorrelationId } from "../audit/correlation.js";
import { AuditLogger } from "../audit/logger.js";
import { PolicyEngine } from "../policy/engine.js";
import { getScanner } from "../security/scanner.js";
import { checkToolDrift } from "../monitor/tool-snapshot.js";
import { AlertEngine } from "../alerts/engine.js";
import type { DownstreamConnection } from "./connection-manager.js";
import type { AuditEntry } from "../schemas/index.js";
import type { TenantContext } from "../auth/types.js";

export interface InterceptResult {
  allowed: boolean;
  response?: {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
  correlationId: string;
}

export class ToolInterceptor {
  private policyEngine: PolicyEngine;
  private auditLogger: AuditLogger;
  private alertEngine: AlertEngine;

  constructor(
    policyEngine: PolicyEngine,
    auditLogger: AuditLogger,
    alertEngine: AlertEngine
  ) {
    this.policyEngine = policyEngine;
    this.auditLogger = auditLogger;
    this.alertEngine = alertEngine;
  }

  /**
   * Run the 9-step security pipeline for a tool call.
   * Returns the downstream response or a blocked response.
   */
  async intercept(
    tenant: TenantContext,
    connection: DownstreamConnection,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<InterceptResult> {
    const correlationId = generateCorrelationId();
    const startTime = performance.now();

    const auditBase: Partial<AuditEntry> = {
      correlationId,
      tenantId: tenant.tenantId,
      userId: tenant.userId,
      serverId: connection.serverId,
      serverName: connection.serverName,
      toolName,
      threatsDetected: 0,
      driftDetected: false,
      requestPiiDetected: false,
      responsePiiDetected: false,
    };

    try {
      // Step 1: Policy evaluation
      const decision = await this.policyEngine.evaluate(tenant.tenantId, {
        serverName: connection.serverName,
        toolName,
        userId: tenant.userId,
      });

      auditBase.policyDecision = decision.action;
      auditBase.policyRuleId = decision.ruleId ?? undefined;

      if (decision.action === "deny") {
        // Fire policy violation alert
        if (decision.ruleName) {
          this.alertEngine
            .firePolicyViolation(tenant.tenantId, {
              serverId: connection.serverId,
              toolName,
              correlationId,
              ruleName: decision.ruleName,
              action: decision.action,
            })
            .catch((err) =>
              console.error("[alert] Failed to fire policy violation:", err)
            );
        }

        const latencyMs = performance.now() - startTime;
        this.logAudit({
          ...(auditBase as AuditEntry),
          latencyMs,
          success: false,
          errorMessage: `Blocked by policy: ${decision.ruleName}`,
        });

        return {
          allowed: false,
          correlationId,
          response: {
            content: [
              {
                type: "text",
                text: `Request blocked by policy "${decision.ruleName}". Contact your administrator.`,
              },
            ],
            isError: true,
          },
        };
      }

      // Step 2: Scan request for injection
      const scanner = getScanner();
      const scanResult = scanner.scan(params);
      auditBase.threatsDetected = scanResult.indicators.length;

      if (scanResult.indicators.length > 0) {
        auditBase.threatDetails = scanResult.indicators;
      }

      if (scanner.shouldBlock(scanResult)) {
        // Fire injection alert
        this.alertEngine
          .fireInjectionAlert(tenant.tenantId, scanResult, {
            serverId: connection.serverId,
            toolName,
            correlationId,
          })
          .catch((err) =>
            console.error("[alert] Failed to fire injection alert:", err)
          );

        const latencyMs = performance.now() - startTime;
        this.logAudit({
          ...(auditBase as AuditEntry),
          policyDecision: "deny",
          latencyMs,
          success: false,
          errorMessage: `Blocked: prompt injection detected (${scanResult.highestSeverity})`,
        });

        return {
          allowed: false,
          correlationId,
          response: {
            content: [
              {
                type: "text",
                text: `Request blocked: security threat detected. Correlation ID: ${correlationId}`,
              },
            ],
            isError: true,
          },
        };
      }

      // Step 3: Check tool drift
      const toolDef = connection.tools.get(toolName);
      if (toolDef) {
        const drift = await checkToolDrift(
          tenant.tenantId,
          connection.serverId,
          toolDef
        );
        auditBase.driftDetected = drift.drifted;

        if (drift.drifted && drift.severity === "critical") {
          // Fire drift alert and block
          this.alertEngine
            .fireDriftAlert(tenant.tenantId, drift, {
              serverId: connection.serverId,
              correlationId,
            })
            .catch((err) =>
              console.error("[alert] Failed to fire drift alert:", err)
            );

          const latencyMs = performance.now() - startTime;
          this.logAudit({
            ...(auditBase as AuditEntry),
            policyDecision: "deny",
            latencyMs,
            success: false,
            errorMessage: `Blocked: critical tool definition drift detected`,
          });

          return {
            allowed: false,
            correlationId,
            response: {
              content: [
                {
                  type: "text",
                  text: `Request blocked: tool "${toolName}" definition has changed unexpectedly. An administrator has been notified.`,
                },
              ],
              isError: true,
            },
          };
        } else if (drift.drifted) {
          // Non-critical drift — alert but allow
          this.alertEngine
            .fireDriftAlert(tenant.tenantId, drift, {
              serverId: connection.serverId,
              correlationId,
            })
            .catch((err) =>
              console.error("[alert] Failed to fire drift alert:", err)
            );
        }
      }

      // Step 4: Forward to downstream server
      const result = await connection.client.callTool({
        name: toolName,
        arguments: params,
      });

      // Step 5: Scan response
      if (result.content && Array.isArray(result.content)) {
        const responseTexts: Record<string, unknown> = {};
        for (let i = 0; i < result.content.length; i++) {
          const item = result.content[i] as { type?: string; text?: string };
          if (item.type === "text" && item.text) {
            responseTexts[`response[${i}]`] = item.text;
          }
        }
        const responseScan = scanner.scan(responseTexts);
        if (responseScan.indicators.length > 0) {
          auditBase.threatsDetected += responseScan.indicators.length;
          // Log but don't block response — flag for review
          console.warn(
            `[gateway] Threats detected in response for ${toolName}: ${responseScan.indicators.length} indicators`
          );
        }
      }

      // Step 6: Log success
      const latencyMs = performance.now() - startTime;
      this.logAudit({
        ...(auditBase as AuditEntry),
        latencyMs,
        success: !result.isError,
        errorMessage: result.isError ? "Downstream error" : undefined,
      });

      return {
        allowed: true,
        correlationId,
        response: result as InterceptResult["response"],
      };
    } catch (error) {
      const latencyMs = performance.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      this.logAudit({
        ...(auditBase as AuditEntry),
        policyDecision: auditBase.policyDecision ?? "allow",
        latencyMs,
        success: false,
        errorMessage,
      });

      return {
        allowed: false,
        correlationId,
        response: {
          content: [
            {
              type: "text",
              text: `Gateway error: ${errorMessage}. Correlation ID: ${correlationId}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  private logAudit(entry: AuditEntry): void {
    this.auditLogger.log(entry);
  }
}
