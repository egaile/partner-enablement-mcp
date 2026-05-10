/**
 * ToolInterceptor — runs every `tools/call` request through the security
 * pipeline before (and after) forwarding it to the downstream MCP server.
 *
 * Pipeline order:
 *   0. Billing guard (cloud usage limits)
 *   1. Policy evaluation
 *   1.5. Rate limiting (when policy rule sets maxCallsPerMinute)
 *   2. Request injection scan
 *   2.5. Request PII detection
 *   3. Tool definition drift check
 *   4. Forward to downstream
 *   5. Response injection scan
 *   5.5. Response PII detection (+ optional redaction)
 *   6. Audit log
 *
 * Every step writes to the in-flight `AuditEntry` so the eventual log entry
 * captures the full decision path. Alerts are fire-and-forget — an alert
 * sink failure must never block a tool call.
 */

import { generateCorrelationId } from "../audit/correlation.js";
import { redactPii, scanForPii } from "../security/pii-scanner.js";
import { RateLimiter } from "../security/rate-limiter.js";
import type { PromptInjectionScanner } from "../security/scanner.js";
import type { PolicyEngine } from "../policy/engine.js";
import type { DriftDetector } from "../monitor/tool-snapshot.js";
import type { ApprovalEngine } from "../approval/engine.js";
import type { AuditEntry } from "../schemas/index.js";
import type {
  AlertSink,
  AuditRecorder,
  BillingGuard,
} from "./ports.js";
import { noopAlertSink, noopBillingGuard } from "./ports.js";
import type { DownstreamConnection, InterceptResult, TenantContext } from "./types.js";

/**
 * Special argument key clients pass to bypass a `require_approval` policy
 * with a previously-issued approval id.
 *
 * Usage from the client side:
 *   tools/call { arguments: { ...realArgs, __approvalId: "<id>" } }
 *
 * The interceptor strips the key before forwarding to the downstream so
 * the underlying tool never sees it.
 */
export const APPROVAL_ID_FIELD = "__approvalId";

export interface ToolInterceptorOptions {
  policyEngine: PolicyEngine;
  driftDetector: DriftDetector;
  scanner: PromptInjectionScanner;
  auditRecorder: AuditRecorder;
  alertSink?: AlertSink;
  billingGuard?: BillingGuard;
  rateLimiter?: RateLimiter;
  /**
   * Optional. When provided, `decision.action === "require_approval"`
   * triggers a real approval flow: create a pending request and block
   * the call with the new id. Clients re-call with `__approvalId` in
   * arguments to consume an approved request. Omit on self-host configs
   * that don't use require_approval policies.
   */
  approvalEngine?: ApprovalEngine;
}

export class ToolInterceptor {
  private readonly policyEngine: PolicyEngine;
  private readonly driftDetector: DriftDetector;
  private readonly scanner: PromptInjectionScanner;
  private readonly auditRecorder: AuditRecorder;
  private readonly alertSink: AlertSink;
  private readonly billingGuard: BillingGuard;
  private readonly approvalEngine: ApprovalEngine | null;
  private readonly rateLimiter: RateLimiter;
  private readonly ownsRateLimiter: boolean;

  constructor(options: ToolInterceptorOptions) {
    this.policyEngine = options.policyEngine;
    this.driftDetector = options.driftDetector;
    this.scanner = options.scanner;
    this.auditRecorder = options.auditRecorder;
    this.alertSink = options.alertSink ?? noopAlertSink;
    this.billingGuard = options.billingGuard ?? noopBillingGuard;
    this.approvalEngine = options.approvalEngine ?? null;

    if (options.rateLimiter) {
      this.rateLimiter = options.rateLimiter;
      this.ownsRateLimiter = false;
    } else {
      this.rateLimiter = new RateLimiter();
      this.rateLimiter.start();
      this.ownsRateLimiter = true;
    }
  }

  /**
   * Stop the embedded rate limiter (no-op if one was supplied by the caller).
   */
  stop(): void {
    if (this.ownsRateLimiter) {
      this.rateLimiter.stop();
    }
  }

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
      try {
        const billing = await this.billingGuard.check(tenant.tenantId);
        if (!billing.allowed) {
          const latencyMs = performance.now() - startTime;
          this.record({
            ...(auditBase as AuditEntry),
            policyDecision: "deny",
            latencyMs,
            success: false,
            errorMessage: billing.reason ?? "Usage limit exceeded",
          });

          return {
            allowed: false,
            correlationId,
            response: {
              content: [
                {
                  type: "text",
                  text:
                    billing.reason ??
                    "Usage limit exceeded. Please upgrade your plan or contact support.",
                },
              ],
              isError: true,
            },
          };
        }
      } catch (err) {
        // Don't block on billing check failure — log and continue.
        console.error("[billing] Check failed, proceeding:", err);
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
          this.alertSink
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
        this.record({
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

      // Step 1.2: Human-in-the-loop approval gate.
      // If policy says require_approval, either consume a previously-issued
      // approval id (allow) or create a new pending request (block).
      if (decision.action === "require_approval") {
        const approvalResult = await this.handleApprovalGate(
          tenant,
          connection,
          toolName,
          params,
          correlationId
        );
        if (approvalResult.blocked) {
          const latencyMs = performance.now() - startTime;
          this.record({
            ...(auditBase as AuditEntry),
            policyDecision: "deny",
            latencyMs,
            success: false,
            errorMessage: approvalResult.reason,
          });
          return {
            allowed: false,
            correlationId,
            response: {
              content: [{ type: "text", text: approvalResult.message }],
              isError: true,
            },
          };
        }
        // Approved — strip the marker so the downstream tool never sees it.
        params = approvalResult.params;
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
          this.alertSink
            .fireRateLimit(tenant.tenantId, {
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
          this.record({
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
      const scanResult = this.scanner.scan(params);
      auditBase.threatsDetected = scanResult.indicators.length;

      if (scanResult.indicators.length > 0) {
        auditBase.threatDetails = scanResult.indicators;
      }

      if (this.scanner.shouldBlock(scanResult)) {
        this.alertSink
          .fireInjection(tenant.tenantId, scanResult, {
            serverId: connection.serverId,
            toolName,
            correlationId,
          })
          .catch((err) =>
            console.error("[alert] Failed to fire injection alert:", err)
          );

        const latencyMs = performance.now() - startTime;
        this.record({
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
        const drift = await this.driftDetector.check(
          tenant.tenantId,
          connection.serverId,
          toolDef
        );
        auditBase.driftDetected = drift.drifted;

        if (drift.drifted && drift.severity === "critical") {
          this.alertSink
            .fireDrift(tenant.tenantId, drift, {
              serverId: connection.serverId,
              correlationId,
            })
            .catch((err) =>
              console.error("[alert] Failed to fire drift alert:", err)
            );

          const latencyMs = performance.now() - startTime;
          this.record({
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
        } else if (drift.drifted && drift.severity === "functional") {
          this.alertSink
            .fireDrift(tenant.tenantId, drift, {
              serverId: connection.serverId,
              correlationId,
            })
            .catch((err) =>
              console.error("[alert] Failed to fire drift alert:", err)
            );
        } else if (drift.drifted && drift.severity === "cosmetic") {
          this.driftDetector
            .approve(
              tenant.tenantId,
              connection.serverId,
              toolDef,
              drift.currentHash
            )
            .catch((err) =>
              console.warn("[drift] Auto-approve cosmetic drift failed:", err)
            );
        }
      }

      // Step 4: Forward to downstream server.
      // OAuth 401 retry is handled by the SDK's authProvider when present.
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
        const responseScan = this.scanner.scan(responseTexts);
        if (responseScan.indicators.length > 0) {
          auditBase.threatsDetected =
            (auditBase.threatsDetected ?? 0) + responseScan.indicators.length;
          console.warn(
            `[gateway] Threats detected in response for ${toolName}: ${responseScan.indicators.length} indicators`
          );
        }

        // Step 5.5: PII detection in response
        const responsePii = scanForPii(responseTexts);
        auditBase.responsePiiDetected = responsePii.detected;

        if (decision.modifiers?.redactPII && responsePii.detected) {
          for (let i = 0; i < result.content.length; i++) {
            const item = result.content[i] as { type?: string; text?: string };
            if (item.type === "text" && item.text) {
              (item as { text: string }).text = redactPii(item.text);
            }
          }
        }
      }

      // Step 6: Log success
      const latencyMs = performance.now() - startTime;
      this.record(
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
      const rawErrorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorMessage = redactPii(rawErrorMessage);

      this.alertSink
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

      this.record({
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

  private record(
    entry: AuditEntry,
    toolParams?: Record<string, unknown>
  ): void {
    this.auditRecorder.record(entry, toolParams);
  }

  /**
   * Resolve a `require_approval` policy decision.
   *
   * - If client passed `__approvalId` and it points to an approved request
   *   belonging to this tenant/user/tool: returns `{ blocked: false, params }`
   *   with the marker stripped.
   * - Otherwise: creates a new pending approval request and returns
   *   `{ blocked: true, message, reason }` describing why the call was
   *   denied and what id to re-submit with.
   *
   * When no `approvalEngine` is wired up, falls back to "block, log
   * reason" so misconfigured deployments fail closed instead of silently
   * letting calls through.
   */
  private async handleApprovalGate(
    tenant: TenantContext,
    connection: DownstreamConnection,
    toolName: string,
    params: Record<string, unknown>,
    correlationId: string
  ): Promise<
    | { blocked: false; params: Record<string, unknown> }
    | { blocked: true; message: string; reason: string }
  > {
    const claimedApprovalId = params[APPROVAL_ID_FIELD];

    if (!this.approvalEngine) {
      return {
        blocked: true,
        message: `Request requires approval, but no approval engine is configured on this gateway.`,
        reason: "require_approval policy hit, no approval engine wired up",
      };
    }

    if (typeof claimedApprovalId === "string" && claimedApprovalId.length > 0) {
      const detail = await this.approvalEngine
        .get(claimedApprovalId, tenant.tenantId)
        .catch(() => null);

      if (!detail) {
        return {
          blocked: true,
          message: `Approval ${claimedApprovalId} not found.`,
          reason: `approval ${claimedApprovalId} not found`,
        };
      }

      // Even if marked approved, reject if it's past its TTL.
      const expired =
        detail.status === "expired" ||
        (detail.status === "pending" &&
          new Date(detail.expiresAt) < new Date());

      if (detail.status === "approved") {
        if (
          detail.userId !== tenant.userId ||
          detail.toolName !== toolName ||
          detail.serverName !== connection.serverName
        ) {
          return {
            blocked: true,
            message: `Approval ${claimedApprovalId} does not match this tool / user.`,
            reason: "approval id mismatch (user/tool/server)",
          };
        }
        const cleaned = { ...params };
        delete cleaned[APPROVAL_ID_FIELD];
        return { blocked: false, params: cleaned };
      }

      if (expired) {
        return {
          blocked: true,
          message: `Approval ${claimedApprovalId} has expired. Submit a new request.`,
          reason: `approval ${claimedApprovalId} expired`,
        };
      }
      if (detail.status === "pending") {
        return {
          blocked: true,
          message: `Approval ${claimedApprovalId} is still pending. Wait for an administrator to approve, then retry.`,
          reason: `approval ${claimedApprovalId} still pending`,
        };
      }
      return {
        blocked: true,
        message: `Approval ${claimedApprovalId} was rejected.`,
        reason: `approval ${claimedApprovalId} rejected`,
      };
    }

    // No approval id claimed — create a new pending request.
    const cleaned = { ...params };
    delete cleaned[APPROVAL_ID_FIELD];
    const req = await this.approvalEngine.requestApproval(tenant.tenantId, {
      correlationId,
      userId: tenant.userId,
      serverName: connection.serverName,
      toolName,
      params: cleaned,
    });
    return {
      blocked: true,
      message: `This tool call requires human approval. Submit approval id: ${req.id} (passing it as __approvalId in arguments) once an administrator approves.`,
      reason: `created approval request ${req.id}`,
    };
  }

}
