interface AuditLog {
  id: string;
  correlation_id: string;
  server_name: string;
  tool_name: string;
  policy_decision: string;
  threats_detected: number;
  drift_detected: boolean;
  latency_ms: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

interface LogTableProps {
  logs: AuditLog[];
}

export default function LogTable({ logs }: LogTableProps) {
  const decisionColor = (d: string) => {
    switch (d) {
      case "allow":
        return "text-emerald-400";
      case "deny":
        return "text-red-400";
      default:
        return "text-amber-400";
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Time
              </th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Server / Tool
              </th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Decision
              </th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Threats
              </th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Latency
              </th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground">{log.server_name}/</span>
                    <span className="font-medium text-foreground">{log.tool_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${decisionColor(log.policy_decision)}`}>
                      {log.policy_decision}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.threats_detected > 0 ? (
                      <span className="text-red-400 font-medium">
                        {log.threats_detected}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {Math.round(log.latency_ms)}ms
                  </td>
                  <td className="px-4 py-3">
                    {log.success ? (
                      <span className="text-emerald-400 text-xs">OK</span>
                    ) : (
                      <span className="text-red-400 text-xs" title={log.error_message ?? ""}>
                        Error
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
