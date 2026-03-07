"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2, KeyRound, ExternalLink } from "lucide-react";
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
  auth_type?: string;
  oauth_scopes?: string[];
}

interface OAuthStatus {
  authType: string;
  configured: boolean;
  hasToken: boolean;
  expiresAt: string | null;
  scopes: string[] | null;
  hasRefreshToken: boolean;
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
  healthy: "bg-emerald-400",
  degraded: "bg-amber-400",
  unreachable: "bg-red-400",
  unknown: "bg-muted-foreground",
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
  const [oauthStatus, setOauthStatus] = useState<OAuthStatus | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
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

      try {
        const oauth = await gatewayFetch<OAuthStatus>(
          `/api/servers/${id}/oauth/status`,
          token
        );
        setOauthStatus(oauth);
      } catch {
        // non-critical — server may not use OAuth
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

  async function handleReauthorize() {
    setAuthorizing(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ authorizeUrl?: string; status?: string }>(
        `/api/servers/${id}/oauth/authorize`,
        token
      );
      if (data.authorizeUrl) {
        window.open(data.authorizeUrl, "_blank");
        toast.info("Complete the OAuth consent in the new tab, then refresh this page.");
      } else {
        toast.success("Server already authorized");
        load();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start OAuth flow";
      toast.error(msg);
    } finally {
      setAuthorizing(false);
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
    return <div className="text-muted-foreground">Server not found</div>;
  }

  const decisionColor = (d: string) => {
    switch (d) {
      case "allow": return "text-emerald-400";
      case "deny": return "text-red-400";
      default: return "text-amber-400";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/servers" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-xl font-semibold text-foreground">{server.name}</h2>
          <div className="flex items-center gap-1.5 ml-2">
            <span className={`w-2 h-2 rounded-full ${healthDot[health.status]}`} />
            <span className="text-xs text-muted-foreground">{healthLabel[health.status]}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{server.enabled ? "Enabled" : "Disabled"}</span>
            <Switch checked={server.enabled} onCheckedChange={handleToggleEnabled} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="font-medium text-foreground">Server Details</h3>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Transport</dt>
                <dd className="text-foreground">{server.transport}</dd>
              </div>
              {server.url && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">URL</dt>
                  <dd className="font-mono text-xs text-foreground">{server.url}</dd>
                </div>
              )}
              {server.command && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Command</dt>
                  <dd className="font-mono text-xs text-foreground">
                    {server.command} {server.args?.join(" ")}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Added</dt>
                <dd className="text-foreground">{new Date(server.created_at).toLocaleDateString()}</dd>
              </div>
              {health.latencyMs !== undefined && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Latency</dt>
                  <dd className="text-foreground">{Math.round(health.latencyMs)}ms</dd>
                </div>
              )}
            </dl>

            {/* OAuth Section */}
            {oauthStatus && (
              <div className="pt-3 border-t border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    OAuth
                  </span>
                  <span className={`text-xs font-medium ${oauthStatus.hasToken ? "text-emerald-400" : "text-amber-400"}`}>
                    {oauthStatus.hasToken ? "Connected" : "Not connected"}
                  </span>
                </div>
                {oauthStatus.scopes && oauthStatus.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {oauthStatus.scopes.map((s) => (
                      <span key={s} className="px-1.5 py-0.5 text-[10px] bg-muted rounded font-mono text-muted-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {oauthStatus.expiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Token expires: {new Date(oauthStatus.expiresAt).toLocaleString()}
                  </p>
                )}
                <button
                  onClick={handleReauthorize}
                  disabled={authorizing}
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 disabled:opacity-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {authorizing ? "Starting..." : oauthStatus.hasToken ? "Re-authorize" : "Authorize"}
                </button>
              </div>
            )}

            <div className="pt-3 border-t border-border/50">
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
                Delete Server
              </button>
            </div>
          </div>

          {/* Recent Audit Entries */}
          {recentAudit.length > 0 && (
            <div className="bg-card rounded-xl border border-border">
              <div className="p-4 border-b border-border">
                <h3 className="font-medium text-foreground">Recent Activity</h3>
              </div>
              <div className="divide-y divide-border/50">
                {recentAudit.map((entry) => (
                  <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">{entry.tool_name}</span>
                      <span className={`text-xs font-medium ${decisionColor(entry.policy_decision)}`}>
                        {entry.policy_decision}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border/50">
                <Link href={`/audit?serverId=${id}`} className="text-xs text-muted-foreground hover:text-foreground">
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
