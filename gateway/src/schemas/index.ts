import { z } from "zod";

// === Enums ===

export const ServerTransportType = z.enum(["stdio", "http"]);
export type ServerTransportType = z.infer<typeof ServerTransportType>;

export const PolicyAction = z.enum([
  "allow",
  "deny",
  "require_approval",
  "log_only",
]);
export type PolicyAction = z.infer<typeof PolicyAction>;

export const AlertSeverity = z.enum(["critical", "high", "medium", "low"]);
export type AlertSeverity = z.infer<typeof AlertSeverity>;

export const AlertType = z.enum([
  "injection_detected",
  "policy_violation",
  "tool_drift",
  "rate_limit_exceeded",
  "auth_failure",
  "server_error",
]);
export type AlertType = z.infer<typeof AlertType>;

export const ThreatSeverity = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);
export type ThreatSeverity = z.infer<typeof ThreatSeverity>;

export const DriftSeverity = z.enum(["critical", "functional", "cosmetic"]);
export type DriftSeverity = z.infer<typeof DriftSeverity>;

// === Server Registration ===

export const RegisterServerSchema = z
  .object({
    name: z.string().min(1).max(100),
    transport: ServerTransportType,
    command: z.string().optional().describe("Command for stdio transport"),
    args: z.array(z.string()).optional().describe("Args for stdio transport"),
    url: z.string().url().optional().describe("URL for HTTP transport"),
    env: z.record(z.string()).optional().describe("Environment variables"),
    authHeaders: z
      .record(z.string())
      .optional()
      .describe("HTTP headers to send to downstream server (e.g. Authorization)"),
    enabled: z.boolean().default(true),
  })
  .strict();

export type RegisterServerInput = z.infer<typeof RegisterServerSchema>;

// === Policy Rule ===

export const PolicyConditionsSchema = z.object({
  servers: z.array(z.string()).optional().describe("Server name globs"),
  tools: z.array(z.string()).optional().describe("Tool name globs"),
  users: z.array(z.string()).optional().describe("User ID list"),
  timeWindows: z
    .array(
      z.object({
        daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
        startHour: z.number().min(0).max(23).optional(),
        endHour: z.number().min(0).max(23).optional(),
      })
    )
    .optional(),
});

export const PolicyModifiersSchema = z.object({
  redactPII: z.boolean().optional(),
  maxCallsPerMinute: z.number().positive().optional(),
  requireMFA: z.boolean().optional(),
});

export const PolicyRuleSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    priority: z.number().int().min(0).max(10000).default(1000),
    conditions: PolicyConditionsSchema,
    action: PolicyAction,
    modifiers: PolicyModifiersSchema.optional(),
    enabled: z.boolean().default(true),
  })
  .strict();

export type PolicyRuleInput = z.infer<typeof PolicyRuleSchema>;

// === Audit Entry ===

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
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;
