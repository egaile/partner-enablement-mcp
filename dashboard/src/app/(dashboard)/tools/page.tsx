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
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Tool Name", "Server", "Hash", "Status", "Action"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-gray-500 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
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
        <h2 className="text-xl font-semibold">Tool Approval Queue</h2>
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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5" />
                      Tool Name
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    Server
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    Hash
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unapproved.map((tool) => (
                  <tr key={tool.snapshotId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{tool.toolName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {tool.serverName}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                        {tool.hash.slice(0, 12)}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
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
          <h3 className="text-sm font-medium text-gray-500">
            Approved Tools ({tools.filter((t) => t.approved).length})
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">
                      Tool Name
                    </th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">
                      Server
                    </th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">
                      Hash
                    </th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tools
                    .filter((t) => t.approved)
                    .map((tool) => (
                      <tr
                        key={tool.snapshotId}
                        className="hover:bg-gray-50 opacity-70"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-gray-400" />
                            <span>{tool.toolName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {tool.serverName}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                            {tool.hash.slice(0, 12)}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-700 hover:bg-green-100"
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
