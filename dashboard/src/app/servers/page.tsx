"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus } from "lucide-react";
import ServerCard from "@/components/servers/ServerCard";
import { gatewayFetch } from "@/lib/api";

interface ServerRecord {
  id: string;
  name: string;
  transport: "stdio" | "http";
  enabled: boolean;
}

export default function ServersPage() {
  const { getToken } = useAuth();
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">MCP Servers</h2>
        <Link
          href="/servers/new"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Server
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading servers...</div>
      ) : servers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No servers registered yet.</p>
          <p className="text-sm mt-1">Add your first MCP server to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((s) => (
            <ServerCard key={s.id} {...s} />
          ))}
        </div>
      )}
    </div>
  );
}
