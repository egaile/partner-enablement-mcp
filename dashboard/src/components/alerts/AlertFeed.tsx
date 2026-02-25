import { AlertTriangle, Shield, GitBranch, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  tool_name: string | null;
  acknowledged: boolean;
  created_at: string;
}

interface AlertFeedProps {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
}

const typeIcons: Record<string, LucideIcon> = {
  injection_detected: Shield,
  policy_violation: AlertTriangle,
  tool_drift: GitBranch,
  rate_limit_exceeded: Zap,
};

const severityColors: Record<string, string> = {
  critical: "border-l-red-600 bg-red-50",
  high: "border-l-orange-500 bg-orange-50",
  medium: "border-l-yellow-500 bg-yellow-50",
  low: "border-l-blue-400 bg-blue-50",
};

export default function AlertFeed({ alerts, onAcknowledge }: AlertFeedProps) {
  return (
    <div className="space-y-3">
      {alerts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No alerts
        </div>
      ) : (
        alerts.map((alert) => {
          const Icon = typeIcons[alert.type] || AlertTriangle;
          const colors = severityColors[alert.severity] || severityColors.low;
          return (
            <div
              key={alert.id}
              className={`rounded-lg border-l-4 p-4 ${colors} ${
                alert.acknowledged ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Icon className="w-4 h-4 mt-0.5 text-gray-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {alert.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">
                        {alert.severity}
                      </span>
                      {alert.tool_name && (
                        <span className="text-xs text-gray-400">
                          {alert.tool_name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-white"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
