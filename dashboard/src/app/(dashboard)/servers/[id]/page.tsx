"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import ToolInventory from "@/components/servers/ToolInventory";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { ServerDetailSkeleton } from "@/components/shared/skeletons";
import { Switch } from "@/components/ui/switch";
import { gatewayFetch } from "@/lib/api";

interface ServerDetail {
  id: string;
  name: string;
  transport: "stdio" | "http";
  command: string | null;
  args: string[] | null;
  url: string | null;
  enabled: boolean;
  created_at: string;
}

interface ToolSnapshot {
  id: string;
  toolName: string;
  tool_name: string;
  definitionHash: string;
  definition_hash: string;
  approved: boolean;
  updatedAt: string;
  updated_at: string;
}

interface HealthStatus {
  status: "healthy" | "degraded" | "unreachable" | "unknown";
  latencyMs?: number;
  consecutiveFailures?: number;
  lastChecked?: string;
}

interface AuditLogEntry {
  id: string;
  tool_name: string;
  policy_decision: string;
  created_at: string;
}

const healthDot: Record<string, string> = {
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  unreachable: "bg-red-500",
  unknown: "bg-gray-400",
};

const healthLabel: Record<string, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  unreachable: "Unreachable",
  unknown: "Unknown",
};

export default function ServerDetailPage() {
  const { getToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [server, setServer] = useState<ServerDetail | null>(null);
  const [snapshots, setSnapshots] = useState<ToolSnapshot[]>([]);
  const [health, setHealth] = useState<HealthStatus>({ status: "unknown" });
  const [recentAudit, setRecentAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const [serversData, snapshotsData] = await Promise.all([
        gatewayFetch<{ servers: ServerDetail[] }>("/api/servers", token),
        gatewayFetch<{ snapshots: ToolSnapshot[] }>(
          `/api/servers/${id}/snapshots`,
          token
        ),
      ]);

      const found = serversData.servers.find((s) => s.id === id);
      setServer(found ?? null);
      setSnapshots(snapshotsData.snapshots);

      // Non-critical fetches
      try {
        const healthData = await gatewayFetch<HealthStatus>(`/api/servers/${id}/health`, token);
        setHealth(healthData);
      } catch {
        // health endpoint may not be available
      }

      try {
        const auditData = await gatewayFetch<{ data: AuditLogEntry[] }>(
          `/api/audit?serverId=${id}&limit=10`,
          token
        );
        setRecentAudit(auditData.data);
      } catch {
        // non-critical
      }
    } catch (err) {
      console.error("Failed to load server:", err);
      toast.error("Failed to load server details");
    } finally {
      setLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/servers/${id}`, token, { method: "DELETE" });
      toast.success("Server deleted");
      router.push("/servers");
    } catch (err) {
      console.error("Failed to delete:", err);
      toast.error("Failed to delete server");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function handleToggleEnabled() {
    if (!server) return;
    const newEnabled = !server.enabled;
    setServer({ ...server, enabled: newEnabled });
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/servers/${id}`, token, {
        method: "PUT",
        body: JSON.stringify({ enabled: newEnabled }),
      });
      toast.success(`Server ${newEnabled ? "enabled" : "disabled"}`);
    } catch (err) {
      setServer({ ...server, enabled: !newEnabled });
      console.error("Failed to toggle:", err);
      toast.error("Failed to update server");
    }
  }

  async function handleApproveSnapshot(snapshotId: string) {
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/servers/${id}/snapshots/${snapshotId}/approve`, token, {
        method: "POST",
      });
      setSnapshots(snapshots.map((s) => (s.id === snapshotId ? { ...s, approved: true } : s)));
      toast.success("Tool approved");
    } catch (err) {
      console.error("Failed to approve:", err);
      toast.error("Failed to approve tool");
    }
  }

  if (loading) {
    return <ServerDetailSkeleton />;
  }

  if (!server) {
    return <div className="text-gray-400">Server not found</div>;
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
        <div className="flex items-center gap-3">
          <Link href="/servers" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-xl font-semibold">{server.name}</h2>
          <div className="flex items-center gap-1.5 ml-2">
            <span className={`w-2 h-2 rounded-full ${healthDot[health.status]}`} />
            <span className="text-xs text-gray-500">{healthLabel[health.status]}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{server.enabled ? "Enabled" : "Disabled"}</span>
            <Switch checked={server.enabled} onCheckedChange={handleToggleEnabled} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
            <h3 className="font-medium">Server Details</h3>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-500">Transport</dt>
                <dd>{server.transport}</dd>
              </div>
              {server.url && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">URL</dt>
                  <dd className="font-mono text-xs">{server.url}</dd>
                </div>
              )}
              {server.command && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Command</dt>
                  <dd className="font-mono text-xs">
                    {server.command} {server.args?.join(" ")}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Added</dt>
                <dd>{new Date(server.created_at).toLocaleDateString()}</dd>
              </div>
              {health.latencyMs !== undefined && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Latency</dt>
                  <dd>{Math.round(health.latencyMs)}ms</dd>
                </div>
              )}
            </dl>

            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800"
              >
                <Trash2 className="w-4 h-4" />
                Delete Server
              </button>
            </div>
          </div>

          {/* Recent Audit Entries */}
          {recentAudit.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-medium">Recent Activity</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {recentAudit.map((entry) => (
                  <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{entry.tool_name}</span>
                      <span className={`text-xs font-medium ${decisionColor(entry.policy_decision)}`}>
                        {entry.policy_decision}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-gray-100">
                <Link href={`/audit?serverId=${id}`} className="text-xs text-gray-500 hover:text-gray-700">
                  View all audit entries
                </Link>
              </div>
            </div>
          )}
        </div>

        <ToolInventory
          snapshots={snapshots.map((s) => ({
            id: s.id,
            toolName: s.tool_name ?? s.toolName,
            definitionHash: s.definition_hash ?? s.definitionHash,
            approved: s.approved,
            updatedAt: s.updated_at ?? s.updatedAt,
          }))}
          onApprove={handleApproveSnapshot}
        />
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Server"
        description="This will permanently remove this server and all its tool snapshots. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
