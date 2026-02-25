"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import AlertFeed from "@/components/alerts/AlertFeed";
import { gatewayFetch } from "@/lib/api";

interface AlertRecord {
  id: string;
  type: string;
  severity: string;
  title: string;
  tool_name: string | null;
  acknowledged: boolean;
  created_at: string;
}

export default function AlertsPage() {
  const { getToken } = useAuth();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open">("open");

  useEffect(() => {
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function loadAlerts() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const params =
        filter === "open" ? "?acknowledged=false" : "";
      const data = await gatewayFetch<{ data: AlertRecord[] }>(
        `/api/alerts${params}`,
        token
      );
      setAlerts(data.data);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledge(id: string) {
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/alerts/${id}/acknowledge`, token, {
        method: "POST",
      });
      setAlerts(
        alerts.map((a) =>
          a.id === id ? { ...a, acknowledged: true } : a
        )
      );
    } catch (err) {
      console.error("Failed to acknowledge:", err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Alerts</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setFilter("open")}
            className={`px-3 py-1.5 text-sm rounded-md ${
              filter === "open"
                ? "bg-white shadow-sm font-medium"
                : "text-gray-500"
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-sm rounded-md ${
              filter === "all"
                ? "bg-white shadow-sm font-medium"
                : "text-gray-500"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading alerts...</div>
      ) : (
        <AlertFeed alerts={alerts} onAcknowledge={handleAcknowledge} />
      )}
    </div>
  );
}
