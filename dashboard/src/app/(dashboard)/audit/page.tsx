"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import LogTable from "@/components/audit/LogTable";
import { gatewayFetch } from "@/lib/api";

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

export default function AuditPage() {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  async function loadLogs() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ data: AuditLog[]; count: number }>(
        `/api/audit?limit=${limit}&offset=${offset}`,
        token
      );
      setLogs(data.data);
      setCount(data.count);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(count / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Audit Log</h2>
        <span className="text-sm text-gray-400">{count} entries</span>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          <LogTable logs={logs} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-30"
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
