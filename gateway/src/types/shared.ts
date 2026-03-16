/**
 * Rec 10: Shared types used by both the gateway and dashboard.
 * Centralizes interface definitions that were previously duplicated
 * across packages, ensuring type consistency.
 */

// ── Audit ──────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  tool_name: string;
  server_name: string;
  policy_decision: string;
  threats_detected: number;
  threat_details: Record<string, unknown> | null;
  created_at: string;
  latency_ms?: number;
}

export interface AuditMetrics {
  totalCalls: number;
  blockedCalls: number;
  threatsDetected: number;
  avgLatencyMs: number;
}

// ── Billing ────────────────────────────────────────────────────────

export interface BillingPlanInfo {
  id: string;
  name: string;
  maxServers: number;
  maxCallsPerMonth: number;
  priceMonthly: number | null;
}

export interface BillingUsageInfo {
  callCount: number;
  blockedCount: number;
  serverCount: number;
}

export interface BillingLimits {
  callsUsedPercent: number;
  serversUsedPercent: number;
}

export interface BillingUsage {
  plan: BillingPlanInfo;
  usage: BillingUsageInfo;
  limits: BillingLimits;
}

// ── Servers ────────────────────────────────────────────────────────

export interface ServerSummary {
  id: string;
  name: string;
  transport: string;
  enabled: boolean;
}

// ── Alerts ─────────────────────────────────────────────────────────

export interface AlertData {
  id: string;
  type: string;
  severity: string;
  title: string;
  created_at: string;
  acknowledged: boolean;
}

// ── Dashboard Overview ─────────────────────────────────────────────

export interface DashboardOverview {
  servers: ServerSummary[];
  serverHealth: Record<string, unknown>;
  recentAudit: { logs: AuditLogEntry[]; total: number };
  metrics: AuditMetrics;
  alerts: { alerts: AlertData[]; total: number };
  billing: BillingUsage;
}
