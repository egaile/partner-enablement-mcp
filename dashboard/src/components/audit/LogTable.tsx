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
        return "text-green-600";
      case "deny":
        return "text-red-600";
      default:
        return "text-yellow-600";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-gray-500 font-medium">
                Time
              </th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">
                Server / Tool
              </th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">
                Decision
              </th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">
                Threats
              </th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">
                Latency
              </th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-400">{log.server_name}/</span>
                    <span className="font-medium">{log.tool_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${decisionColor(log.policy_decision)}`}>
                      {log.policy_decision}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.threats_detected > 0 ? (
                      <span className="text-red-600 font-medium">
                        {log.threats_detected}
                      </span>
                    ) : (
                      <span className="text-gray-300">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {Math.round(log.latency_ms)}ms
                  </td>
                  <td className="px-4 py-3">
                    {log.success ? (
                      <span className="text-green-600 text-xs">OK</span>
                    ) : (
                      <span className="text-red-600 text-xs" title={log.error_message ?? ""}>
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
