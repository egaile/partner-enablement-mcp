/**
 * Shared zod schemas for gateway-core public types.
 *
 * Phase 0: subset relevant to storage interfaces. The full proxy + auth
 * schemas land when those modules move from gateway/ in a later phase.
 */

import { z } from "zod";

export const PolicyAction = z.enum([
  "allow",
  "deny",
  "require_approval",
  "log_only",
]);
export type PolicyAction = z.infer<typeof PolicyAction>;

/**
 * Canonical alert event names. The proxy fires these via `AlertSink`;
 * the webhook dispatcher forwards them verbatim as the `event` field in
 * each delivery payload, and webhook subscriptions filter on them.
 */
export const ALERT_EVENTS = {
  injectionDetected: "injection_detected",
  policyViolation: "policy_violation",
  toolDrift: "tool_drift",
  rateLimitExceeded: "rate_limit_exceeded",
  authFailure: "auth_failure",
  serverError: "server_error",
} as const;

export type AlertEventName = (typeof ALERT_EVENTS)[keyof typeof ALERT_EVENTS];

export const AuditEntrySchema = z.object({
  correlationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().optional(),
  serverId: z.string().uuid(),
  serverName: z.string(),
  toolName: z.string(),
  policyDecision: PolicyAction,
  policyRuleId: z.string().uuid().optional(),
  threatsDetected: z.number().int().min(0).default(0),
  threatDetails: z.any().optional(),
  driftDetected: z.boolean().default(false),
  latencyMs: z.number().min(0),
  requestPiiDetected: z.boolean().default(false),
  responsePiiDetected: z.boolean().default(false),
  success: z.boolean(),
  errorMessage: z.string().optional(),
  /** Highest data classification seen in request/response (set by industry pack scanners). */
  dataClassification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .optional(),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;
