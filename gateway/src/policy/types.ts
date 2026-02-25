export interface PolicyDecision {
  action: "allow" | "deny" | "require_approval" | "log_only";
  ruleId: string | null;
  ruleName: string | null;
  modifiers: {
    redactPII?: boolean;
    maxCallsPerMinute?: number;
    requireMFA?: boolean;
  };
}
