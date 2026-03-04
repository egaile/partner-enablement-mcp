import { generateCorrelationId } from "../audit/correlation.js";
import { AuditLogger } from "../audit/logger.js";
import { PolicyEngine } from "../policy/engine.js";
import { getScanner } from "../security/scanner.js";
import { scanForPii, redactPii } from "../security/pii-scanner.js";
import { RateLimiter } from "../security/rate-limiter.js";
import { checkToolDrift } from "../monitor/tool-snapshot.js";
import { AlertEngine } from "../alerts/engine.js";
import type { PlanCache } from "../billing/plan-cache.js";
import { isWithinSoftLimit } from "../billing/plans.js";
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
  private rateLimiter: RateLimiter;
  private planCache: PlanCache | null = null;

  constructor(
    policyEngine: PolicyEngine,
    auditLogger: AuditLogger,
    alertEngine: AlertEngine
  ) {
    this.policyEngine = policyEngine;
    this.auditLogger = auditLogger;
    this.alertEngine = alertEngine;
    this.rateLimiter = new RateLimiter();
    this.rateLimiter.start();
  }

  /**
   * Set the plan cache for usage limit enforcement.
   */
  setPlanCache(cache: PlanCache): void {
    this.planCache = cache;
  }

  /**
   * Run the security pipeline for a tool call.
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
      // Step 0: Usage limit check (billing tier enforcement)
      if (this.planCache) {
        try {
          const { plan, usage } = await this.planCache.getPlanAndUsage(
            tenant.tenantId
          );

          if (!isWithinSoftLimit(usage.callCount, plan)) {
            const latencyMs = performance.now() - startTime;
            this.logAudit({
              ...(auditBase as AuditEntry),
              policyDecision: "deny",
              latencyMs,
              success: false,
              errorMessage: `Usage limit exceeded: ${usage.callCount}/${plan.maxCallsPerMonth} calls this period`,
            });

            return {
              allowed: false,
              correlationId,
              response: {
                content: [
                  {
                    type: "text",
                    text: `Usage limit exceeded (${plan.maxCallsPerMonth} calls/month on ${plan.name} plan). Please upgrade your plan or contact support.`,
                  },
                ],
                isError: true,
              },
            };
          }
        } catch (err) {
          // Don't block on billing check failure — log and continue
          console.error("[billing] Plan check failed, proceeding:", err);
        }
      }

      // Step 1: Policy evaluation
      const decision = await this.policyEngine.evaluate(tenant.tenantId, {
        serverName: connection.serverName,
        toolName,
        userId: tenant.userId,
      });

      auditBase.policyDecision = decision.action;
      auditBase.policyRuleId = decision.ruleId ?? undefined;

      if (decision.action === "deny") {
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

      // Step 1.5: Rate limiting (if policy specifies maxCallsPerMinute)
      if (decision.modifiers?.maxCallsPerMinute) {
        const key = RateLimiter.buildKey(
          tenant.tenantId,
          tenant.userId,
          connection.serverName,
          toolName
        );
        const rateResult = this.rateLimiter.check(
          key,
          decision.modifiers.maxCallsPerMinute
        );

        if (!rateResult.allowed) {
          this.alertEngine
            .fireRateLimitExceeded(tenant.tenantId, {
              serverId: connection.serverId,
              toolName,
              correlationId,
              userId: tenant.userId,
              currentRate: rateResult.current,
              limitPerMinute: rateResult.limit,
            })
            .catch((err) =>
              console.error("[alert] Failed to fire rate limit alert:", err)
            );

          const latencyMs = performance.now() - startTime;
          this.logAudit({
            ...(auditBase as AuditEntry),
            policyDecision: "deny",
            latencyMs,
            success: false,
            errorMessage: `Rate limit exceeded: ${rateResult.current}/${rateResult.limit} per minute`,
          });

          return {
            allowed: false,
            correlationId,
            response: {
              content: [
                {
                  type: "text",
                  text: `Rate limit exceeded (${rateResult.limit}/min). Please try again later.`,
                },
              ],
              isError: true,
            },
          };
        }
      }

      // Step 2: Scan request for injection
      const scanner = getScanner();
      const scanResult = scanner.scan(params);
      auditBase.threatsDetected = scanResult.indicators.length;

      if (scanResult.indicators.length > 0) {
        auditBase.threatDetails = scanResult.indicators;
      }

      if (scanner.shouldBlock(scanResult)) {
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

      // Step 2.5: PII detection in request
      const piiResult = scanForPii(params);
      auditBase.requestPiiDetected = piiResult.detected;

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
      // (OAuth 401 retry is handled automatically by the SDK's authProvider)
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
          console.warn(
            `[gateway] Threats detected in response for ${toolName}: ${responseScan.indicators.length} indicators`
          );
        }

        // Step 5.5: PII detection in response
        const responsePii = scanForPii(responseTexts);
        auditBase.responsePiiDetected = responsePii.detected;

        // Apply PII redaction if policy requires it
        if (decision.modifiers?.redactPII && responsePii.detected) {
          for (let i = 0; i < result.content.length; i++) {
            const item = result.content[i] as { type?: string; text?: string };
            if (item.type === "text" && item.text) {
              (item as { text: string }).text = redactPii(item.text);
            }
          }
        }
      }

      // Step 6: Log success (with Atlassian metadata enrichment)
      const latencyMs = performance.now() - startTime;
      this.logAudit(
        {
          ...(auditBase as AuditEntry),
          latencyMs,
          success: !result.isError,
          errorMessage: result.isError ? "Downstream error" : undefined,
        },
        params
      );

      return {
        allowed: true,
        correlationId,
        response: result as InterceptResult["response"],
      };
    } catch (error) {
      const latencyMs = performance.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Fire server error alert for downstream failures
      this.alertEngine
        .fireServerError(tenant.tenantId, {
          serverId: connection.serverId,
          serverName: connection.serverName,
          correlationId,
          errorMessage,
          errorType: "tool_call_failure",
        })
        .catch((err) =>
          console.error("[alert] Failed to fire server error alert:", err)
        );

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

  private logAudit(
    entry: AuditEntry,
    toolParams?: Record<string, unknown>
  ): void {
    this.auditLogger.logEnriched(entry, toolParams);
  }
}
