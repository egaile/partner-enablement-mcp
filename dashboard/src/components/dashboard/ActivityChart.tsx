"use client";

import dynamic from "next/dynamic";

// Lazy-load recharts to keep initial bundle small
const AreaChart = dynamic(
  () => import("recharts").then((m) => m.AreaChart),
  { ssr: false }
);
const Area = dynamic(
  () => import("recharts").then((m) => m.Area),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

export interface AuditLogEntry {
  id: string;
  created_at: string;
  policy_decision: string;
  latency_ms?: number;
}

interface Bucket {
  label: string;
  total: number;
  blocked: number;
  avgLatency: number;
}

/**
 * Bucket audit logs by time intervals for charting.
 */
export function bucketAuditLogs(
  logs: AuditLogEntry[],
  timeRange: string
): Bucket[] {
  const bucketConfig: Record<string, { intervalMs: number; format: (d: Date) => string }> = {
    "1h": { intervalMs: 5 * 60 * 1000, format: (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}` },
    "6h": { intervalMs: 30 * 60 * 1000, format: (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}` },
    "24h": { intervalMs: 60 * 60 * 1000, format: (d) => `${d.getHours()}:00` },
    "7d": { intervalMs: 24 * 60 * 60 * 1000, format: (d) => `${d.getMonth() + 1}/${d.getDate()}` },
  };

  const config = bucketConfig[timeRange] ?? bucketConfig["24h"];
  const rangeMs: Record<string, number> = { "1h": 3600000, "6h": 21600000, "24h": 86400000, "7d": 604800000 };
  const now = Date.now();
  const start = now - (rangeMs[timeRange] ?? 86400000);
  const bucketCount = Math.ceil((now - start) / config.intervalMs);

  const buckets: Bucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = start + i * config.intervalMs;
    buckets.push({
      label: config.format(new Date(bucketStart)),
      total: 0,
      blocked: 0,
      avgLatency: 0,
    });
  }

  const latencyAccum: number[][] = buckets.map(() => []);

  for (const log of logs) {
    const t = new Date(log.created_at).getTime();
    if (t < start || t > now) continue;
    const idx = Math.min(Math.floor((t - start) / config.intervalMs), bucketCount - 1);
    buckets[idx].total++;
    if (log.policy_decision === "deny" || log.policy_decision === "blocked") {
      buckets[idx].blocked++;
    }
    if (log.latency_ms != null) {
      latencyAccum[idx].push(log.latency_ms);
    }
  }

  for (let i = 0; i < buckets.length; i++) {
    const lat = latencyAccum[i];
    buckets[i].avgLatency = lat.length > 0
      ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length)
      : 0;
  }

  return buckets;
}

interface ActivityChartProps {
  data: Bucket[];
}

export default function ActivityChart({ data }: ActivityChartProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">Activity Timeline</h3>
      {data.length === 0 ? (
        <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
          No activity in this time range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillBlocked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#22d3ee"
              fill="url(#fillTotal)"
              strokeWidth={2}
              name="Total Calls"
            />
            <Area
              type="monotone"
              dataKey="blocked"
              stroke="#ef4444"
              fill="url(#fillBlocked)"
              strokeWidth={1.5}
              name="Blocked"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
