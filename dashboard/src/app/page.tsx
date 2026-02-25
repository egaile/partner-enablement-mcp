"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Activity, ShieldAlert, Server, Clock } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import RecentActivity from "@/components/dashboard/RecentActivity";
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

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;

        const [metricsData, auditData] = await Promise.all([
          gatewayFetch<Metrics>("/api/audit/metrics", token),
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
    }
    load();
  }, [getToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Calls (24h)"
          value={metrics?.totalCalls ?? 0}
          icon={Activity}
          color="blue"
        />
        <MetricCard
          title="Blocked Calls"
          value={metrics?.blockedCalls ?? 0}
          icon={ShieldAlert}
          color="red"
        />
        <MetricCard
          title="Threats Detected"
          value={metrics?.threatsDetected ?? 0}
          icon={Server}
          color="orange"
        />
        <MetricCard
          title="Avg Latency"
          value={`${Math.round(metrics?.avgLatencyMs ?? 0)}ms`}
          icon={Clock}
          color="green"
        />
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
