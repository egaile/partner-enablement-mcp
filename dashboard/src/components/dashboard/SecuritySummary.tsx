"use client";

import Link from "next/link";
import {
  Shield,
  AlertTriangle,
  GitBranch,
  Zap,
  Lock,
  ServerCrash,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { relativeTime } from "@/lib/format-time";

export interface AlertSummary {
  id: string;
  type: string;
  severity: string;
  title: string;
  created_at: string;
}

const typeIcons: Record<string, LucideIcon> = {
  injection_detected: Shield,
  policy_violation: AlertTriangle,
  tool_drift: GitBranch,
  rate_limit_exceeded: Zap,
  auth_failure: Lock,
  server_error: ServerCrash,
};

const typeLabels: Record<string, string> = {
  injection_detected: "injection",
  policy_violation: "policy violation",
  tool_drift: "tool drift",
  rate_limit_exceeded: "rate limit",
  auth_failure: "auth failure",
  server_error: "server error",
};

const severityBorder: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-blue-400",
};

const pillColors: Record<string, string> = {
  injection_detected: "bg-red-500/10 text-red-400 border-red-500/20",
  policy_violation: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  tool_drift: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  rate_limit_exceeded: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  auth_failure: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  server_error: "bg-red-500/10 text-red-400 border-red-500/20",
};

interface SecuritySummaryProps {
  alerts: AlertSummary[];
  onAcknowledge: (id: string) => void;
}

export default function SecuritySummary({ alerts, onAcknowledge }: SecuritySummaryProps) {
  // Group alerts by type
  const grouped = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  // Find most critical alert (critical > high > medium > low)
  const severityOrder = ["critical", "high", "medium", "low"];
  const sorted = [...alerts].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );
  const mostCritical = sorted[0] ?? null;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Security Summary</h3>
        <Link href="/alerts" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm">No unacknowledged alerts</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Alert type pills */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(grouped).map(([type, count]) => {
              const Icon = typeIcons[type] || AlertTriangle;
              const colors = pillColors[type] || "bg-muted text-muted-foreground border-border";
              return (
                <Link
                  key={type}
                  href={`/alerts?type=${type}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium hover:opacity-80 transition-opacity ${colors}`}
                >
                  <Icon className="w-3 h-3" />
                  {count} {typeLabels[type] || type.replace(/_/g, " ")}
                </Link>
              );
            })}
          </div>

          {/* Most critical alert */}
          {mostCritical && (
            <div className={`rounded-lg border-l-4 ${severityBorder[mostCritical.severity] || "border-l-border"} bg-muted/30 p-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {mostCritical.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {mostCritical.severity}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(mostCritical.created_at)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onAcknowledge(mostCritical.id)}
                  className="text-xs px-2 py-1 border border-border rounded hover:bg-muted transition-colors shrink-0"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
