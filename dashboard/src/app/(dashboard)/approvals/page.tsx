"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import { AlertFeedSkeleton } from "@/components/shared/skeletons";
import { gatewayFetch } from "@/lib/api";

interface ApprovalRecord {
  id: string;
  correlationId: string;
  userId: string;
  serverName: string;
  toolName: string;
  params: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  expiresAt: string;
}

export default function ApprovalsPage() {
  const { getToken } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ data: ApprovalRecord[] }>(
        "/api/approvals",
        token
      );
      setApprovals(data.data);
    } catch (err) {
      console.error("Failed to load approvals:", err);
      toast.error("Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleAction(id: string, action: "approve" | "reject") {
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/approvals/${id}/${action}`, token, {
        method: "POST",
      });
      setApprovals(
        approvals.map((a) =>
          a.id === id
            ? { ...a, status: action === "approve" ? "approved" : "rejected" }
            : a
        )
      );
      toast.success(`Request ${action === "approve" ? "approved" : "rejected"}`);
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
      toast.error(`Failed to ${action} request`);
    }
  }

  const isExpired = (a: ApprovalRecord) =>
    a.status === "pending" && new Date(a.expiresAt) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Approval Queue</h2>
        <Badge variant="secondary">{approvals.filter((a) => a.status === "pending" && !isExpired(a)).length} pending</Badge>
      </div>

      {loading ? (
        <AlertFeedSkeleton />
      ) : approvals.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No pending approvals"
          description="Approval requests will appear here when a policy requires human approval for a tool call."
        />
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => {
            const expired = isExpired(a);
            return (
              <div
                key={a.id}
                className={`bg-card rounded-xl border border-border p-4 ${
                  a.status !== "pending" || expired ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {a.serverName}/{a.toolName}
                      </span>
                      <Badge
                        variant={
                          expired
                            ? "secondary"
                            : a.status === "pending"
                              ? "default"
                              : a.status === "approved"
                                ? "default"
                                : "destructive"
                        }
                        className={
                          a.status === "approved"
                            ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15"
                            : expired
                              ? "bg-muted text-muted-foreground"
                              : ""
                        }
                      >
                        {expired ? "expired" : a.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Requested by {a.userId} at{" "}
                      {new Date(a.requestedAt).toLocaleString()}
                    </p>
                    {Object.keys(a.params).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">
                          View parameters
                        </summary>
                        <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-auto max-h-32 text-foreground">
                          {JSON.stringify(a.params, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  {a.status === "pending" && !expired && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(a.id, "reject")}
                        className="text-red-400 hover:text-red-300"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAction(a.id, "approve")}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Expires {new Date(a.expiresAt).toLocaleString()}
                  </span>
                  <span className="font-mono">{a.correlationId.slice(0, 8)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
