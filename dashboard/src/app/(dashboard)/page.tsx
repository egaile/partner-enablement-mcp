"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Activity, ShieldAlert, Server, Clock, Plus, Shield, ScrollText, AlertTriangle, Zap } from "lucide-react";
import Link from "next/link";
import MetricCard from "@/components/dashboard/MetricCard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { DashboardSkeleton } from "@/components/shared/skeletons";
import { gatewayFetch } from "@/lib/api";

interface Metrics {
  totalCalls: number;
  blockedCalls: number;
  threatsDetected: number;
  avgLatencyMs: number;
}

interface AuditLogEntry {
  id: string;
  tool_name: string;
  server_name: string;
  policy_decision: string;
  threats_detected: number;
  threat_details: Record<string, unknown> | null;
  created_at: string;
}

interface BillingUsage {
  plan: {
    id: string;
    name: string;
    maxServers: number;
    maxCallsPerMonth: number;
    priceMonthly: number | null;
  };
  usage: {
    callCount: number;
    blockedCount: number;
    serverCount: number;
  };
  limits: {
    callsUsedPercent: number;
    serversUsedPercent: number;
  };
}

const timeRanges = [
  { label: "1h", value: "1h", ms: 3600000 },
  { label: "6h", value: "6h", ms: 21600000 },
  { label: "24h", value: "24h", ms: 86400000 },
  { label: "7d", value: "7d", ms: 604800000 },
];

const quickActions = [
  { label: "Block a Jira Project", href: "/policies/new", icon: Shield },
  { label: "Require Approval for Writes", href: "/policies/new", icon: ShieldAlert },
  { label: "View Audit Log", href: "/audit", icon: ScrollText },
];

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);
  const [billing, setBilling] = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("24h");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const since = new Date(
        Date.now() - (timeRanges.find((t) => t.value === timeRange)?.ms ?? 86400000)
      ).toISOString();

      const [metricsData, auditData, billingData] = await Promise.all([
        gatewayFetch<Metrics>(`/api/audit/metrics?since=${since}`, token),
        gatewayFetch<{ data: AuditLogEntry[] }>(
          "/api/audit?limit=10",
          token
        ),
        gatewayFetch<BillingUsage>("/api/billing/usage", token).catch(() => null),
      ]);

      setMetrics(metricsData);
      setRecentLogs(auditData.data);
      if (billingData) setBilling(billingData);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken, timeRange]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Extract Atlassian-specific stats from recent logs
  const jiraOps = recentLogs.filter(
    (l) =>
      l.tool_name.includes("jira") ||
      l.server_name.toLowerCase().includes("atlassian") ||
      l.server_name.toLowerCase().includes("rovo")
  ).length;
  const confluenceOps = recentLogs.filter(
    (l) =>
      l.tool_name.includes("confluence") ||
      l.tool_name.includes("page")
  ).length;

  return (
    <div className="space-y-6">
      {/* Usage warning bar */}
      {billing && billing.limits.callsUsedPercent >= 80 && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
            billing.limits.callsUsedPercent >= 100
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
          }`}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 text-sm">
            {billing.limits.callsUsedPercent >= 100 ? (
              <>
                Usage limit exceeded: {(billing.usage.callCount ?? 0).toLocaleString()}/
                {(billing.plan.maxCallsPerMonth ?? 0).toLocaleString()} calls this month.
                AI agent requests may be blocked.
              </>
            ) : (
              <>
                Approaching usage limit: {(billing.usage.callCount ?? 0).toLocaleString()}/
                {(billing.plan.maxCallsPerMonth ?? 0).toLocaleString()} calls this month (
                {billing.limits.callsUsedPercent}%).
              </>
            )}
          </div>
          <Link
            href="/settings?tab=billing"
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-card border border-border hover:border-cyan-500/30 transition-colors whitespace-nowrap"
          >
            Upgrade Plan
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => { setLoading(true); setTimeRange(range.value); }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                timeRange === range.value
                  ? "bg-card shadow-sm font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={`Total Calls (${timeRange})`}
          value={metrics?.totalCalls ?? 0}
          icon={Activity}
          color="blue"
          trend={metrics && metrics.totalCalls > 0 ? "up" : "neutral"}
        />
        <MetricCard
          title="Threats Blocked"
          value={metrics?.blockedCalls ?? 0}
          icon={ShieldAlert}
          color="red"
          trend={metrics && metrics.blockedCalls > 0 ? "up" : "neutral"}
        />
        <MetricCard
          title="Threats Detected"
          value={metrics?.threatsDetected ?? 0}
          icon={Shield}
          color="orange"
          trend={metrics && metrics.threatsDetected > 0 ? "up" : "neutral"}
        />
        <MetricCard
          title="Avg Latency"
          value={`${Math.round(metrics?.avgLatencyMs ?? 0)}ms`}
          icon={Clock}
          color="green"
        />
      </div>

      {/* Atlassian operations breakdown */}
      {(jiraOps > 0 || confluenceOps > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Jira Operations (recent)</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{jiraOps}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Confluence Operations (recent)</p>
                <p className="text-2xl font-semibold text-foreground mt-1">{confluenceOps}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Server className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan usage bar */}
      {billing && billing.plan.maxCallsPerMonth && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Monthly Usage ({billing.plan.name} Plan)
            </span>
            <span className="text-foreground font-medium">
              {(billing.usage.callCount ?? 0).toLocaleString()} / {(billing.plan.maxCallsPerMonth ?? 0).toLocaleString()} calls
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                billing.limits.callsUsedPercent >= 100
                  ? "bg-red-500"
                  : billing.limits.callsUsedPercent >= 80
                    ? "bg-amber-500"
                    : "bg-cyan-500"
              }`}
              style={{
                width: `${Math.min(billing.limits.callsUsedPercent, 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-3 bg-card rounded-xl border border-border p-4 hover:border-cyan-500/30 hover:shadow-glow-sm transition-all"
          >
            <div className="p-2 rounded-lg bg-muted/50">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">{label}</span>
            <Plus className="w-4 h-4 text-muted-foreground ml-auto" />
          </Link>
        ))}
      </div>

      <RecentActivity
        items={recentLogs.map((log) => {
          // Extract Atlassian context from threat_details
          const atlassian = (log.threat_details as Record<string, unknown>)?.atlassian as Record<string, unknown> | undefined;
          const projectKey = atlassian?.projectKey as string | undefined;
          const spaceKey = atlassian?.spaceKey as string | undefined;

          let tool = log.tool_name;
          if (projectKey) tool = `${tool} [${projectKey}]`;
          else if (spaceKey) tool = `${tool} [${spaceKey}]`;

          return {
            id: log.id,
            tool,
            server: log.server_name,
            decision: log.policy_decision,
            threats: log.threats_detected,
            time: new Date(log.created_at).toLocaleString(),
          };
        })}
      />
    </div>
  );
}
