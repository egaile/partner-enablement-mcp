import { Server, Wifi, Terminal } from "lucide-react";
import Link from "next/link";

interface ServerCardProps {
  id: string;
  name: string;
  transport: "stdio" | "http";
  enabled: boolean;
  toolCount?: number;
}

export default function ServerCard({
  id,
  name,
  transport,
  enabled,
  toolCount,
}: ServerCardProps) {
  return (
    <Link
      href={`/servers/${id}`}
      className="block bg-card rounded-xl border border-border p-5 hover:border-cyan-500/30 hover:shadow-glow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}
          >
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {transport === "http" ? (
                <Wifi className="w-3 h-3 text-muted-foreground" />
              ) : (
                <Terminal className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">{transport}</span>
              {toolCount !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {toolCount} tool{toolCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            enabled
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {enabled ? "Active" : "Disabled"}
        </span>
      </div>
    </Link>
  );
}
