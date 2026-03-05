"use client";

import Link from "next/link";
import { Server } from "lucide-react";
import { relativeTime } from "@/lib/format-time";

export interface ServerHealth {
  id: string;
  name: string;
  transport: string;
  toolCount: number;
  status: "healthy" | "degraded" | "down" | "unknown";
  lastChecked: string | null;
}

const statusDot: Record<string, string> = {
  healthy: "bg-emerald-400",
  degraded: "bg-amber-400",
  down: "bg-red-400",
  unknown: "bg-gray-400",
};

const statusLabel: Record<string, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

interface ServerHealthGridProps {
  servers: ServerHealth[];
}

export default function ServerHealthGrid({ servers }: ServerHealthGridProps) {
  if (servers.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Connected Servers</h3>
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm">
          <Server className="w-8 h-8 mb-2 opacity-40" />
          <p>No servers connected</p>
          <Link href="/servers/new" className="text-cyan-400 hover:text-cyan-300 mt-1 text-xs">
            Add a server
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Connected Servers</h3>
        <Link href="/servers" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {servers.map((server) => (
          <Link
            key={server.id}
            href={`/servers/${server.id}`}
            className="flex items-center gap-3 rounded-lg border border-border/50 p-3 hover:border-cyan-500/30 hover:bg-muted/30 transition-all"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${statusDot[server.status]} shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{server.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {server.transport}
                </span>
                <span className="text-xs text-muted-foreground">{server.toolCount} tools</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-muted-foreground block">{statusLabel[server.status]}</span>
              {server.lastChecked && (
                <span className="text-[10px] text-muted-foreground/60">{relativeTime(server.lastChecked)}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
