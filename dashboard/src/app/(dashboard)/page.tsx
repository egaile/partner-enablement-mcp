"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Activity, ShieldAlert, Server, Clock, Plus, Shield, ScrollText, TrendingUp, TrendingDown } from "lucide-react";
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
  created_at: string;
}

const timeRanges = [
  { label: "1h", value: "1h", ms: 3600000 },
  { label: "6h", value: "6h", ms: 21600000 },
  { label: "24h", value: "24h", ms: 86400000 },
  { label: "7d", value: "7d", ms: 604800000 },
];

const quickActions = [
  { label: "Add Server", href: "/servers/new", icon: Server },
  { label: "Create Policy", href: "/policies/new", icon: Shield },
  { label: "View Audit Log", href: "/audit", icon: ScrollText },
];

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("24h");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const since = new Date(
        Date.now() - (timeRanges.find((t) => t.value === timeRange)?.ms ?? 86400000)
      ).toISOString();

      const [metricsData, auditData] = await Promise.all([
        gatewayFetch<Metrics>(`/api/audit/metrics?since=${since}`, token),
        gatewayFetch<{ data: AuditLogEntry[] }>(
          "/api/audit?limit=10",
          token
        ),
      ]);

      setMetrics(metricsData);
      setRecentLogs(auditData.data);
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

  return (
    <div className="space-y-6">
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
          title="Blocked Calls"
          value={metrics?.blockedCalls ?? 0}
          icon={ShieldAlert}
          color="red"
          trend={metrics && metrics.blockedCalls > 0 ? "up" : "neutral"}
        />
        <MetricCard
          title="Threats Detected"
          value={metrics?.threatsDetected ?? 0}
          icon={Server}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
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
        items={recentLogs.map((log) => ({
          id: log.id,
          tool: log.tool_name,
          server: log.server_name,
          decision: log.policy_decision,
          threats: log.threats_detected,
          time: new Date(log.created_at).toLocaleString(),
        }))}
      />
    </div>
  );
}
