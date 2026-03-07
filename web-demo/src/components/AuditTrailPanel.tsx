'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Shield, Clock, AlertTriangle, CheckCircle2, XCircle, Eye, RefreshCw } from 'lucide-react';
import { Badge } from './ui/Badge';

interface AuditEntry {
  id: string;
  correlation_id: string;
  tool_name: string;
  server_name: string;
  policy_decision: 'allow' | 'deny' | 'require_approval' | 'log_only';
  threats_detected: number;
  threat_details?: {
    atlassian?: {
      projectKey?: string;
      issueKey?: string;
      spaceKey?: string;
      operationType?: string;
      isWriteOperation?: boolean;
    };
  };
  drift_detected: boolean;
  latency_ms: number;
  request_pii_detected: boolean;
  response_pii_detected: boolean;
  success: boolean;
  error_message?: string;
  created_at: string;
}

interface AuditTrailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isRunning?: boolean;
}

function PolicyBadge({ decision }: { decision: string }) {
  switch (decision) {
    case 'allow':
      return <Badge variant="green">Allow</Badge>;
    case 'deny':
      return <Badge variant="red">Deny</Badge>;
    case 'require_approval':
      return <Badge variant="amber">Approval</Badge>;
    case 'log_only':
      return <Badge variant="gray">Log</Badge>;
    default:
      return <Badge variant="gray">{decision}</Badge>;
  }
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function stripServerPrefix(toolName: string): string {
  const idx = toolName.indexOf('__');
  return idx >= 0 ? toolName.slice(idx + 2) : toolName;
}

export function AuditTrailPanel({ isOpen, onClose, isRunning }: AuditTrailPanelProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tools/audit-trail?limit=20');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.data ?? []);
        setTotalCount(data.count ?? 0);
      }
    } catch {
      // Silently fail — panel just shows empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchEntries();
    }
  }, [isOpen, fetchEntries]);

  // Auto-refresh while running
  useEffect(() => {
    if (!isOpen || !isRunning) return;
    const interval = setInterval(fetchEntries, 5000);
    return () => clearInterval(interval);
  }, [isOpen, isRunning, fetchEntries]);

  if (!isOpen) return null;

  const allowCount = entries.filter((e) => e.policy_decision === 'allow').length;
  const denyCount = entries.filter((e) => e.policy_decision === 'deny').length;
  const piiCount = entries.filter((e) => e.request_pii_detected || e.response_pii_detected).length;
  const avgLatency = entries.length > 0
    ? Math.round(entries.reduce((sum, e) => sum + (e.latency_ms || 0), 0) / entries.length)
    : 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-claude-orange" />
            <h2 className="font-semibold text-gray-900">Audit Trail</h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {totalCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchEntries}
              disabled={isLoading}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-200 text-center">
          <div>
            <p className="text-sm font-bold text-green-600">{allowCount}</p>
            <p className="text-[10px] text-gray-500">Allowed</p>
          </div>
          <div>
            <p className="text-sm font-bold text-red-600">{denyCount}</p>
            <p className="text-[10px] text-gray-500">Denied</p>
          </div>
          <div>
            <p className="text-sm font-bold text-amber-600">{piiCount}</p>
            <p className="text-[10px] text-gray-500">PII Flags</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-700">{avgLatency}ms</p>
            <p className="text-[10px] text-gray-500">Avg Latency</p>
          </div>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Eye className="w-8 h-8 mb-2" />
              <p className="text-sm">No audit entries yet</p>
              <p className="text-xs">Run the demo to generate entries</p>
            </div>
          )}

          {isLoading && entries.length === 0 && (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <AuditEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-[10px] text-gray-500 text-center">
            Every MCP tool call is logged with policy decisions, threat scans, PII detection, and Atlassian metadata.
          </p>
        </div>
      </div>
    </>
  );
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const atlassian = entry.threat_details?.atlassian;
  const isWrite = atlassian?.isWriteOperation ?? false;
  const toolDisplay = stripServerPrefix(entry.tool_name);

  return (
    <div className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {entry.success ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          )}
          <code className="text-xs font-mono text-gray-800 truncate">{toolDisplay}</code>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PolicyBadge decision={entry.policy_decision} />
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-gray-500 ml-5.5 pl-[22px]">
        <span className="flex items-center gap-0.5">
          <Clock className="w-3 h-3" />
          {formatTime(entry.created_at)}
        </span>
        <span>{entry.latency_ms}ms</span>
        {isWrite && (
          <Badge variant="amber" size="sm">write</Badge>
        )}
        {(entry.request_pii_detected || entry.response_pii_detected) && (
          <span className="flex items-center gap-0.5 text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            PII
          </span>
        )}
      </div>

      {/* Atlassian metadata */}
      {atlassian && (atlassian.projectKey || atlassian.spaceKey || atlassian.operationType) && (
        <div className="flex flex-wrap gap-1 mt-1.5 pl-[22px]">
          {atlassian.projectKey && (
            <span className="text-[10px] font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
              {atlassian.projectKey}
            </span>
          )}
          {atlassian.issueKey && (
            <span className="text-[10px] font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
              {atlassian.issueKey}
            </span>
          )}
          {atlassian.spaceKey && (
            <span className="text-[10px] font-mono bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
              {atlassian.spaceKey}
            </span>
          )}
          {atlassian.operationType && (
            <span className="text-[10px] text-gray-400">
              {atlassian.operationType}
            </span>
          )}
        </div>
      )}

      {/* Error message */}
      {entry.error_message && (
        <p className="text-[10px] text-red-600 mt-1 pl-[22px] line-clamp-2">{entry.error_message}</p>
      )}
    </div>
  );
}
