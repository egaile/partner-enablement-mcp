import { useState } from "react";
import { AlertTriangle, Shield, GitBranch, Zap, ChevronDown, ChevronRight, Lock, ServerCrash } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  tool_name: string | null;
  details?: unknown;
  correlation_id?: string | null;
  acknowledged: boolean;
  created_at: string;
}

interface AlertFeedProps {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const typeIcons: Record<string, LucideIcon> = {
  injection_detected: Shield,
  policy_violation: AlertTriangle,
  tool_drift: GitBranch,
  rate_limit_exceeded: Zap,
  auth_failure: Lock,
  server_error: ServerCrash,
};

const severityColors: Record<string, string> = {
  critical: "border-l-red-500 bg-red-500/10",
  high: "border-l-orange-500 bg-orange-500/10",
  medium: "border-l-yellow-500 bg-yellow-500/10",
  low: "border-l-blue-400 bg-blue-500/10",
};

export default function AlertFeed({ alerts, onAcknowledge, selected, onToggleSelect }: AlertFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {alerts.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground text-sm">
          No alerts
        </div>
      ) : (
        alerts.map((alert) => {
          const Icon = typeIcons[alert.type] || AlertTriangle;
          const colors = severityColors[alert.severity] || severityColors.low;
          const isExpanded = expandedId === alert.id;

          return (
            <div
              key={alert.id}
              className={`rounded-lg border-l-4 ${colors} ${
                alert.acknowledged ? "opacity-60" : ""
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {onToggleSelect && !alert.acknowledged && (
                      <input
                        type="checkbox"
                        checked={selected?.has(alert.id) ?? false}
                        onChange={() => onToggleSelect(alert.id)}
                        className="mt-1 rounded border-border"
                      />
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                      className="mt-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <Icon className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {alert.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground capitalize">
                          {alert.severity}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {alert.type.replace(/_/g, " ")}
                        </span>
                        {alert.tool_name && (
                          <span className="text-xs text-muted-foreground">
                            {alert.tool_name}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => onAcknowledge(alert.id)}
                      className="text-xs px-2 py-1 border border-border rounded hover:bg-muted"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {alert.correlation_id && (
                      <div>
                        <span className="text-muted-foreground block mb-1">Correlation ID</span>
                        <code className="bg-muted px-2 py-0.5 rounded font-mono text-foreground">
                          {alert.correlation_id}
                        </code>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground block mb-1">Alert Type</span>
                      <span className="text-foreground">{alert.type}</span>
                    </div>
                  </div>
                  {alert.details ? (
                    <div className="mt-3">
                      <span className="text-xs text-muted-foreground block mb-1">Details</span>
                      <pre className="text-xs bg-muted rounded p-3 overflow-x-auto font-mono text-foreground">
                        {JSON.stringify(alert.details, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
