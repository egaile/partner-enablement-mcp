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
      className="block bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${enabled ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}
          >
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {transport === "http" ? (
                <Wifi className="w-3 h-3 text-gray-400" />
              ) : (
                <Terminal className="w-3 h-3 text-gray-400" />
              )}
              <span className="text-xs text-gray-400">{transport}</span>
              {toolCount !== undefined && (
                <span className="text-xs text-gray-400">
                  {toolCount} tool{toolCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            enabled
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {enabled ? "Active" : "Disabled"}
        </span>
      </div>
    </Link>
  );
}
