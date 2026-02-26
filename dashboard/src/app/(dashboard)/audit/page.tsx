"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { ScrollText, Download, ChevronDown, ChevronRight } from "lucide-react";
import { LogTableSkeleton } from "@/components/shared/skeletons";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gatewayFetch } from "@/lib/api";

interface AuditLog {
  id: string;
  correlation_id: string;
  server_name: string;
  tool_name: string;
  user_id: string;
  policy_decision: string;
  policy_rule_id: string | null;
  threats_detected: number;
  threat_details: unknown;
  drift_detected: boolean;
  latency_ms: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

interface ServerOption {
  id: string;
  name: string;
}

const decisions = ["all", "allow", "deny", "require_approval", "log_only"];
const pageSizes = [25, 50, 100];

export default function AuditPage() {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [filterServer, setFilterServer] = useState("");
  const [filterTool, setFilterTool] = useState("");
  const [filterDecision, setFilterDecision] = useState("all");

  // Load server list for filter dropdown
  useEffect(() => {
    async function loadServers() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await gatewayFetch<{ servers: ServerOption[] }>("/api/servers", token);
        setServers(data.servers);
      } catch {
        // non-critical
      }
    }
    loadServers();
  }, [getToken]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (filterServer) params.set("serverId", filterServer);
      if (filterTool) params.set("toolName", filterTool);
      if (filterDecision !== "all") params.set("decision", filterDecision);

      const data = await gatewayFetch<{ data: AuditLog[]; count: number }>(
        `/api/audit?${params}`,
        token
      );
      setLogs(data.data);
      setCount(data.count);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [getToken, offset, limit, filterServer, filterTool, filterDecision]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Reset pagination when filters change
  useEffect(() => {
    setOffset(0);
  }, [filterServer, filterTool, filterDecision, limit]);

  const totalPages = Math.ceil(count / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  function goToPage(page: number) {
    setOffset((page - 1) * limit);
  }

  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }

  function exportCSV() {
    if (logs.length === 0) return;
    const headers = ["Time", "Server", "Tool", "Decision", "Threats", "Drift", "Latency (ms)", "Status", "Error", "Correlation ID"];
    const rows = logs.map((log) => [
      new Date(log.created_at).toISOString(),
      log.server_name,
      log.tool_name,
      log.policy_decision,
      String(log.threats_detected),
      String(log.drift_detected),
      String(Math.round(log.latency_ms)),
      log.success ? "OK" : "Error",
      log.error_message || "",
      log.correlation_id,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  const decisionColor = (d: string) => {
    switch (d) {
      case "allow": return "text-green-600";
      case "deny": return "text-red-600";
      default: return "text-yellow-600";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Audit Log</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{count} entries</span>
          <Button size="sm" variant="outline" onClick={exportCSV} disabled={logs.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterServer}
          onChange={(e) => setFilterServer(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="">All Servers</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Input
          placeholder="Filter by tool name..."
          value={filterTool}
          onChange={(e) => setFilterTool(e.target.value)}
          className="w-48"
        />
        <select
          value={filterDecision}
          onChange={(e) => setFilterDecision(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          {decisions.map((d) => (
            <option key={d} value={d}>{d === "all" ? "All Decisions" : d}</option>
          ))}
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white ml-auto"
        >
          {pageSizes.map((s) => (
            <option key={s} value={s}>{s} per page</option>
          ))}
        </select>
      </div>

      {loading ? (
        <LogTableSkeleton />
      ) : count === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit logs yet"
          description="Audit entries will appear here once tool calls are processed through the gateway."
        />
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="w-8 px-2 py-3" />
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Time</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Server / Tool</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Decision</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Threats</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Latency</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        <td className="px-2 py-3 text-gray-400">
                          {expandedId === log.id ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
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
                            <span className="text-red-600 font-medium">{log.threats_detected}</span>
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
                            <span className="text-red-600 text-xs">Error</span>
                          )}
                        </td>
                      </tr>
                      {expandedId === log.id && (
                        <tr key={`${log.id}-detail`} className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                              <div>
                                <span className="text-gray-400 block mb-1">Correlation ID</span>
                                <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                                  {log.correlation_id}
                                </code>
                              </div>
                              <div>
                                <span className="text-gray-400 block mb-1">Drift Detected</span>
                                <span className={log.drift_detected ? "text-yellow-600 font-medium" : "text-gray-500"}>
                                  {log.drift_detected ? "Yes" : "No"}
                                </span>
                              </div>
                              {log.policy_rule_id && (
                                <div>
                                  <span className="text-gray-400 block mb-1">Policy Rule ID</span>
                                  <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                                    {log.policy_rule_id}
                                  </code>
                                </div>
                              )}
                              {log.error_message && (
                                <div>
                                  <span className="text-gray-400 block mb-1">Error</span>
                                  <span className="text-red-600">{log.error_message}</span>
                                </div>
                              )}
                            </div>
                            {log.threat_details ? (
                              <div className="mt-3">
                                <span className="text-xs text-gray-400 block mb-1">Threat Details</span>
                                <pre className="text-xs bg-gray-100 rounded p-3 overflow-x-auto font-mono text-gray-700">
                                  {JSON.stringify(log.threat_details, null, 2)}
                                </pre>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Numbered pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-50"
              >
                Previous
              </button>
              {getPageNumbers().map((page, i) =>
                page === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      page === currentPage
                        ? "bg-gray-900 text-white"
                        : "border hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
