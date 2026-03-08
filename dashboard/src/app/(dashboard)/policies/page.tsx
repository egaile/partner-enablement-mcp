"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { PolicyListSkeleton } from "@/components/shared/skeletons";
import EmptyState from "@/components/shared/EmptyState";
import SearchInput from "@/components/shared/SearchInput";
import { Switch } from "@/components/ui/switch";
import { gatewayFetch } from "@/lib/api";

interface PolicyRecord {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  action: string;
  conditions: Record<string, unknown>;
  enabled: boolean;
}

const actionOptions = ["all", "allow", "deny", "require_approval", "log_only"];

export default function PoliciesPage() {
  const { getToken } = useAuth();
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<PolicyRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPolicies = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ policies: PolicyRecord[] }>(
        "/api/policies",
        token
      );
      setPolicies(data.policies);
    } catch (err) {
      console.error("Failed to load policies:", err);
      toast.error("Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/policies/${deleteTarget.id}`, token, {
        method: "DELETE",
      });
      setPolicies(policies.filter((p) => p.id !== deleteTarget.id));
      toast.success("Policy deleted");
    } catch (err) {
      console.error("Failed to delete:", err);
      toast.error("Failed to delete policy");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleToggleEnabled(policy: PolicyRecord) {
    const newEnabled = !policy.enabled;
    // Optimistic update — use functional setState to avoid stale closure
    setPolicies((prev) => prev.map((p) => (p.id === policy.id ? { ...p, enabled: newEnabled } : p)));
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/policies/${policy.id}`, token, {
        method: "PUT",
        body: JSON.stringify({ enabled: newEnabled }),
      });
      toast.success(`Policy ${newEnabled ? "enabled" : "disabled"}`);
    } catch (err) {
      // Revert on failure
      setPolicies((prev) => prev.map((p) => (p.id === policy.id ? { ...p, enabled: !newEnabled } : p)));
      console.error("Failed to toggle:", err);
      toast.error("Failed to update policy");
    }
  }

  const actionBadge = (action: string) => {
    switch (action) {
      case "allow":
        return "bg-emerald-500/15 text-emerald-400";
      case "deny":
        return "bg-red-500/15 text-red-400";
      case "require_approval":
        return "bg-amber-500/15 text-amber-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const filtered = policies.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesAction = filterAction === "all" || p.action === filterAction;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Policy Rules</h2>
        <Link
          href="/policies/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Create Rule
        </Link>
      </div>

      {!loading && policies.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <SearchInput
            placeholder="Search policies..."
            value={search}
            onChange={setSearch}
            className="flex-1 min-w-[200px]"
          />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
          >
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {a === "all" ? "All Actions" : a.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <PolicyListSkeleton />
      ) : policies.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No policy rules configured"
          description="All requests are allowed by default. Create your first policy to start controlling access."
          actionLabel="Create Rule"
          actionHref="/policies/new"
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No policies matching your filters
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border/50">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`px-5 py-4 flex items-center justify-between ${!p.enabled ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <Switch
                  checked={p.enabled}
                  onCheckedChange={() => handleToggleEnabled(p)}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono w-8">
                      #{p.priority}
                    </span>
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${actionBadge(p.action)}`}
                    >
                      {p.action}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 ml-11 truncate">
                      {p.description}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(p)}
                className="text-muted-foreground hover:text-red-400 ml-3"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Policy Rule"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
