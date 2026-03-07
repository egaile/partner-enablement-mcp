'use client';

import { Activity, Shield, Fingerprint, AlertTriangle, Clock } from 'lucide-react';

interface ToolCallStatsProps {
  /** Total Rovo tool calls made so far */
  totalCalls: number;
  /** Number of calls blocked by policy */
  blocked: number;
  /** Number of PII scans performed */
  piiScans: number;
  /** Number of threats detected */
  threats: number;
}

export function ToolCallStats({ totalCalls, blocked, piiScans, threats }: ToolCallStatsProps) {
  if (totalCalls === 0) return null;

  return (
    <div className="border-b border-gray-100 bg-gray-50/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto text-xs">
          <StatItem
            icon={<Activity className="w-3 h-3 text-claude-orange" />}
            label="Rovo tool calls"
            value={totalCalls}
            color="text-gray-700"
          />
          <div className="w-px h-3 bg-gray-200 shrink-0" />
          <StatItem
            icon={<Shield className="w-3 h-3 text-red-500" />}
            label="blocked"
            value={blocked}
            color={blocked > 0 ? 'text-red-600' : 'text-gray-500'}
          />
          <div className="w-px h-3 bg-gray-200 shrink-0" />
          <StatItem
            icon={<Fingerprint className="w-3 h-3 text-purple-500" />}
            label="PII scans"
            value={piiScans}
            color="text-gray-500"
          />
          <div className="w-px h-3 bg-gray-200 shrink-0" />
          <StatItem
            icon={<AlertTriangle className="w-3 h-3 text-amber-500" />}
            label="threats"
            value={threats}
            color={threats > 0 ? 'text-amber-600' : 'text-gray-500'}
          />
        </div>
      </div>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {icon}
      <span className={`font-semibold ${color}`}>{value}</span>
      <span className="text-gray-400">{label}</span>
    </div>
  );
}
