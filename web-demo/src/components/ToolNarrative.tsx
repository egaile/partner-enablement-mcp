'use client';

import { useState } from 'react';
import { Terminal, ChevronDown } from 'lucide-react';
import { TOOL_NARRATIVES } from '@/lib/constants';
import { LiveDataBadge } from './LiveDataBadge';

interface ToolNarrativeProps {
  toolName: string;
  parameters?: Record<string, unknown>;
}

export function ToolNarrative({ toolName, parameters }: ToolNarrativeProps) {
  const [showParams, setShowParams] = useState(false);
  const narrative = TOOL_NARRATIVES[toolName];

  if (!narrative) return null;

  return (
    <div className="rounded-xl border-l-4 border-claude-orange bg-amber-50/60 p-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="w-4 h-4 text-claude-orange" />
          <code className="text-sm font-mono font-semibold text-anthropic-900">
            {toolName}
          </code>
        </div>
        <LiveDataBadge />
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{narrative}</p>
      {parameters && Object.keys(parameters).length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowParams(!showParams)}
            className="flex items-center gap-1 text-xs font-medium text-claude-orange hover:text-amber-700 transition-colors"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200 ${showParams ? 'rotate-180' : ''}`}
            />
            View request parameters
          </button>
          {showParams && (
            <pre className="mt-2 p-3 bg-anthropic-900 text-amber-100 rounded-lg text-xs font-mono overflow-x-auto">
              {JSON.stringify(parameters, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
