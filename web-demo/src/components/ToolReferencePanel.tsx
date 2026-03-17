'use client';

import { useState } from 'react';
import { X, CheckCircle2, Shield, BookOpen } from 'lucide-react';
import { ROVO_TOOLS, TOOL_CATEGORIES, getToolStats } from '@/lib/rovo-tools';
import { Badge } from './ui/Badge';

interface ToolReferencePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ToolReferencePanel({ isOpen, onClose }: ToolReferencePanelProps) {
  const stats = getToolStats();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-claude-orange" />
              <h2 className="text-lg font-semibold text-gray-900">Rovo MCP Tools</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {stats.total} tools available &middot; {stats.usedInDemo} used in this demo
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-600">{stats.readTools} Read</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-gray-600">{stats.writeTools} Write</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-claude-orange" />
            <span className="text-gray-600">{stats.usedInDemo} in demo</span>
          </div>
        </div>

        {/* Tool list by category */}
        <div className="px-5 py-4 space-y-6">
          {TOOL_CATEGORIES.map((category) => {
            const tools = ROVO_TOOLS.filter((t) => t.category === category);
            if (tools.length === 0) return null;

            return (
              <div key={category}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {category}
                  <span className="text-gray-400 ml-1">({tools.length})</span>
                </h3>
                <div className="space-y-1.5">
                  {tools.map((tool) => (
                    <div
                      key={tool.name}
                      className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                        tool.usedInWorkflows.length > 0
                          ? 'bg-amber-50/50 border border-amber-100'
                          : tool.available
                            ? 'bg-gray-50'
                            : 'bg-gray-50 opacity-50'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        <RiskBadge risk={tool.risk} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs font-mono text-gray-800 truncate">
                            {tool.name}
                          </code>
                          {tool.usedInWorkflows.length > 0 && (
                            <CheckCircle2 className="w-3 h-3 text-claude-orange shrink-0" />
                          )}
                          {!tool.available && (
                            <span className="text-[9px] text-gray-400 font-medium">N/A</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-start gap-2 text-xs text-gray-500">
            <Shield className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
            <p>
              Every tool call passes through the MCP Security Gateway&apos;s pipeline: authentication,
              policy evaluation, injection scanning, PII detection, and audit logging.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function RiskBadge({ risk }: { risk: 'read' | 'write' | 'delete' }) {
  if (risk === 'read') return <Badge variant="green">R</Badge>;
  if (risk === 'write') return <Badge variant="amber">W</Badge>;
  return <Badge variant="red">D</Badge>;
}
