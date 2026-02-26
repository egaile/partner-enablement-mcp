"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import AlertFeed from "@/components/alerts/AlertFeed";
import { AlertFeedSkeleton } from "@/components/shared/skeletons";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { gatewayFetch } from "@/lib/api";

interface AlertRecord {
  id: string;
  type: string;
  severity: string;
  title: string;
  tool_name: string | null;
  details: unknown;
  correlation_id: string | null;
  acknowledged: boolean;
  created_at: string;
}

const severities = ["all", "critical", "high", "medium", "low"];
const alertTypes = ["all", "injection_detected", "policy_violation", "tool_drift", "rate_limit_exceeded", "auth_failure", "server_error"];

export default function AlertsPage() {
  const { getToken } = useAuth();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open">("open");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAcking, setBulkAcking] = useState(false);

  // Pagination
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(0);
  const limit = 25;

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (filter === "open") params.set("acknowledged", "false");
      if (filterSeverity !== "all") params.set("severity", filterSeverity);
      if (filterType !== "all") params.set("type", filterType);

      const data = await gatewayFetch<{ data: AlertRecord[]; count?: number }>(
        `/api/alerts?${params}`,
        token
      );
      setAlerts(data.data);
      setCount(data.count ?? data.data.length);
    } catch (err) {
      console.error("Failed to load alerts:", err);
      toast.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [getToken, filter, filterSeverity, filterType, offset]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Reset pagination on filter change
  useEffect(() => {
    setOffset(0);
    setSelected(new Set());
  }, [filter, filterSeverity, filterType]);

  async function handleAcknowledge(id: string) {
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/alerts/${id}/acknowledge`, token, { method: "POST" });
      setAlerts(alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
      toast.success("Alert acknowledged");
    } catch (err) {
      console.error("Failed to acknowledge:", err);
      toast.error("Failed to acknowledge alert");
    }
  }

  async function handleBulkAcknowledge() {
    if (selected.size === 0) return;
    setBulkAcking(true);
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch("/api/alerts/bulk-acknowledge", token, {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      setAlerts(alerts.map((a) => (selected.has(a.id) ? { ...a, acknowledged: true } : a)));
      toast.success(`${selected.size} alert${selected.size > 1 ? "s" : ""} acknowledged`);
      setSelected(new Set());
    } catch (err) {
      console.error("Failed to bulk acknowledge:", err);
      toast.error("Failed to acknowledge alerts");
    } finally {
      setBulkAcking(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const unacked = alerts.filter((a) => !a.acknowledged);
    if (selected.size === unacked.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unacked.map((a) => a.id)));
    }
  }

  const totalPages = Math.ceil(count / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Alerts</h2>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setFilter("open")}
            className={`px-3 py-1.5 text-sm rounded-md ${
              filter === "open" ? "bg-card shadow-sm font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-sm rounded-md ${
              filter === "all" ? "bg-card shadow-sm font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
        >
          {severities.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Severities" : s}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
        >
          {alertTypes.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All Types" : t.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        {selected.size > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkAcknowledge}
            disabled={bulkAcking}
            className="ml-auto"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            {bulkAcking ? "Acknowledging..." : `Acknowledge ${selected.size}`}
          </Button>
        )}
      </div>

      {loading ? (
        <AlertFeedSkeleton />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === "open" ? "No open alerts" : "No alerts yet"}
          description={
            filter === "open"
              ? "All alerts have been acknowledged. Nice work!"
              : "Alerts will appear here when security events are detected."
          }
        />
      ) : (
        <>
          {/* Select all checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === alerts.filter((a) => !a.acknowledged).length}
              onChange={toggleSelectAll}
              className="rounded border-border"
            />
            <span className="text-xs text-muted-foreground">Select all unacknowledged</span>
          </div>

          <AlertFeed
            alerts={alerts}
            onAcknowledge={handleAcknowledge}
            selected={selected}
            onToggleSelect={toggleSelect}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted/30 text-foreground"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-30 hover:bg-muted/30 text-foreground"
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
