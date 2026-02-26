"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, Server } from "lucide-react";
import { toast } from "sonner";
import ServerCard from "@/components/servers/ServerCard";
import { ServerCardSkeleton } from "@/components/shared/skeletons";
import EmptyState from "@/components/shared/EmptyState";
import SearchInput from "@/components/shared/SearchInput";
import { gatewayFetch } from "@/lib/api";

interface ServerRecord {
  id: string;
  name: string;
  transport: "stdio" | "http";
  enabled: boolean;
  toolCount?: number;
}

type StatusFilter = "all" | "active" | "disabled";

export default function ServersPage() {
  const { getToken } = useAuth();
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ servers: ServerRecord[] }>(
        "/api/servers",
        token
      );
      setServers(data.servers);
    } catch (err) {
      console.error("Failed to load servers:", err);
      toast.error("Failed to load servers");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = servers.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && s.enabled) ||
      (statusFilter === "disabled" && !s.enabled);
    return matchesSearch && matchesStatus;
  });

  const activeCount = servers.filter((s) => s.enabled).length;
  const disabledCount = servers.filter((s) => !s.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">MCP Servers</h2>
        <Link
          href="/servers/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Server
        </Link>
      </div>

      {!loading && servers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {([
              { value: "all" as StatusFilter, label: `All (${servers.length})` },
              { value: "active" as StatusFilter, label: `Active (${activeCount})` },
              { value: "disabled" as StatusFilter, label: `Disabled (${disabledCount})` },
            ]).map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  statusFilter === tab.value
                    ? "bg-card shadow-sm font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <SearchInput
            placeholder="Search servers..."
            value={search}
            onChange={setSearch}
            className="flex-1 min-w-[200px]"
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <ServerCardSkeleton key={i} />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No servers registered"
          description="Add your first MCP server to start securing tool calls through the gateway."
          actionLabel="Add Server"
          actionHref="/servers/new"
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No servers matching your filters
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <ServerCard key={s.id} {...s} />
          ))}
        </div>
      )}
    </div>
  );
}
