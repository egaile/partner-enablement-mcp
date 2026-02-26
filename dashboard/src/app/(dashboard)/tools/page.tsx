"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Wrench, CheckCircle, AlertTriangle, Shield } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/shared/EmptyState";
import { gatewayFetch } from "@/lib/api";

interface ServerRecord {
  id: string;
  name: string;
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

interface ToolRow {
  snapshotId: string;
  serverId: string;
  serverName: string;
  toolName: string;
  hash: string;
  approved: boolean;
  updatedAt: string;
}

function ToolTableSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {["Tool Name", "Server", "Hash", "Status", "Action"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-36" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-4 w-24" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-8 w-20" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ToolsPage() {
  const { getToken } = useAuth();
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const serversData = await gatewayFetch<{ servers: ServerRecord[] }>(
        "/api/servers",
        token
      );

      const allTools: ToolRow[] = [];

      await Promise.all(
        serversData.servers.map(async (server) => {
          try {
            const snapshotsData = await gatewayFetch<{
              snapshots: ToolSnapshot[];
            }>(`/api/servers/${server.id}/snapshots`, token);

            for (const s of snapshotsData.snapshots) {
              const name = s.tool_name ?? s.toolName;
              const hash = s.definition_hash ?? s.definitionHash;
              const updatedAt = s.updated_at ?? s.updatedAt;

              allTools.push({
                snapshotId: s.id,
                serverId: server.id,
                serverName: server.name,
                toolName: name,
                hash,
                approved: s.approved,
                updatedAt,
              });
            }
          } catch (err) {
            console.error(
              `Failed to load snapshots for server ${server.name}:`,
              err
            );
          }
        })
      );

      setTools(allTools);
    } catch (err) {
      console.error("Failed to load tools:", err);
      toast.error("Failed to load tool snapshots");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(tool: ToolRow) {
    setApprovingIds((prev) => new Set(prev).add(tool.snapshotId));
    try {
      const token = await getToken();
      if (!token) return;

      await gatewayFetch(
        `/api/servers/${tool.serverId}/snapshots/${tool.snapshotId}/approve`,
        token,
        { method: "POST" }
      );

      setTools((prev) =>
        prev.map((t) =>
          t.snapshotId === tool.snapshotId ? { ...t, approved: true } : t
        )
      );
      toast.success(`Approved ${tool.toolName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve tool";
      toast.error(msg);
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(tool.snapshotId);
        return next;
      });
    }
  }

  const unapproved = tools.filter((t) => !t.approved);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Tool Approval Queue</h2>
        {!loading && (
          <Badge variant="secondary">
            {unapproved.length} unapproved
          </Badge>
        )}
      </div>

      {loading ? (
        <ToolTableSkeleton />
      ) : unapproved.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="All tools approved"
          description="No unapproved or drifted tool snapshots found across your servers. New tools will appear here when they are discovered."
        />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5" />
                      Tool Name
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                    Server
                  </th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                    Hash
                  </th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {unapproved.map((tool) => (
                  <tr key={tool.snapshotId} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{tool.toolName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tool.serverName}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                        {tool.hash.slice(0, 12)}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className="bg-amber-500/15 text-amber-400 hover:bg-amber-500/15"
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Unapproved
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(tool)}
                        disabled={approvingIds.has(tool.snapshotId)}
                      >
                        <CheckCircle className="w-4 h-4" />
                        {approvingIds.has(tool.snapshotId)
                          ? "Approving..."
                          : "Approve"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Show approved tools below for reference */}
      {!loading && tools.filter((t) => t.approved).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Approved Tools ({tools.filter((t) => t.approved).length})
          </h3>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      Tool Name
                    </th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      Server
                    </th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      Hash
                    </th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {tools
                    .filter((t) => t.approved)
                    .map((tool) => (
                      <tr
                        key={tool.snapshotId}
                        className="hover:bg-muted/30 opacity-70"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground">{tool.toolName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {tool.serverName}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                            {tool.hash.slice(0, 12)}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
