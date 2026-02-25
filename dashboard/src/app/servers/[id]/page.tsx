"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import ToolInventory from "@/components/servers/ToolInventory";
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

export default function ServerDetailPage() {
  const { getToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [server, setServer] = useState<ServerDetail | null>(null);
  const [snapshots, setSnapshots] = useState<ToolSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
      } catch (err) {
        console.error("Failed to load server:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken, id]);

  async function handleDelete() {
    if (!confirm("Delete this server? This cannot be undone.")) return;
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/servers/${id}`, token, { method: "DELETE" });
      router.push("/servers");
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  if (loading) {
    return <div className="text-gray-400 text-sm">Loading...</div>;
  }

  if (!server) {
    return <div className="text-gray-400">Server not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/servers" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-xl font-semibold">{server.name}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <dt className="text-gray-500">Status</dt>
              <dd>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    server.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {server.enabled ? "Active" : "Disabled"}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Added</dt>
              <dd>{new Date(server.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>

          <div className="pt-3 border-t border-gray-100">
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800"
            >
              <Trash2 className="w-4 h-4" />
              Delete Server
            </button>
          </div>
        </div>

        <ToolInventory
          snapshots={snapshots.map((s) => ({
            id: s.id,
            toolName: s.tool_name ?? s.toolName,
            definitionHash: s.definition_hash ?? s.definitionHash,
            approved: s.approved,
            updatedAt: s.updated_at ?? s.updatedAt,
          }))}
        />
      </div>
    </div>
  );
}
