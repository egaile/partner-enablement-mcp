'use client';

import { Shield, Database, Cloud, ArrowRight, ArrowDown } from 'lucide-react';

export function ArchitectureDiagram() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
      <h3 className="text-sm font-semibold text-gray-700 mb-6 text-center uppercase tracking-wider">
        System Architecture
      </h3>

      {/* Desktop horizontal layout */}
      <div className="hidden md:flex items-start justify-between gap-2">
        {/* Your App / Claude */}
        <DiagramNode
          title="Your App / Claude"
          description="AI agent making tool calls"
          color="amber"
          icon={<Cloud className="w-5 h-5" />}
        />

        <AnimatedArrow />

        {/* MCP Security Gateway */}
        <div className="flex flex-col items-center gap-3">
          <DiagramNode
            title="MCP Security Gateway"
            description="Policy, scanning, audit"
            color="red"
            icon={<Shield className="w-5 h-5" />}
            highlighted
          />
          {/* Security pipeline sub-labels */}
          <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">Auth</span>
            <span>&rarr;</span>
            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">Policy</span>
            <span>&rarr;</span>
            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">Scan</span>
            <span>&rarr;</span>
            <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded">Audit</span>
          </div>
        </div>

        <AnimatedArrow />

        {/* Atlassian Rovo MCP */}
        <DiagramNode
          title="Atlassian Rovo MCP"
          description="40+ Jira & Confluence tools"
          color="blue"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 5.143c-2.857 0-4.571 1.714-4.571 4.286 0 3.428 3.143 4.571 5.143 6.857.286.286.571.571.857.857.286-.286.571-.571.857-.857 2-2.286 5.143-3.429 5.143-6.857 0-2.572-1.714-4.286-4.571-4.286-1.143 0-1.429.286-1.429.286s-.286-.286-1.429-.286z" />
            </svg>
          }
        />

        <AnimatedArrow />

        {/* Jira & Confluence */}
        <DiagramNode
          title="Jira & Confluence"
          description="Live project data"
          color="indigo"
          icon={<Database className="w-5 h-5" />}
        />
      </div>

      {/* Mobile vertical layout */}
      <div className="flex md:hidden flex-col items-center gap-3">
        <DiagramNode
          title="Your App / Claude"
          description="AI agent making tool calls"
          color="amber"
          icon={<Cloud className="w-5 h-5" />}
          compact
        />
        <AnimatedArrowDown />
        <div className="flex flex-col items-center gap-2">
          <DiagramNode
            title="MCP Security Gateway"
            description="Policy, scanning, audit"
            color="red"
            icon={<Shield className="w-5 h-5" />}
            highlighted
            compact
          />
          <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">Auth</span>
            <span>&rarr;</span>
            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">Policy</span>
            <span>&rarr;</span>
            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">Scan</span>
          </div>
        </div>
        <AnimatedArrowDown />
        <DiagramNode
          title="Atlassian Rovo MCP"
          description="40+ Jira & Confluence tools"
          color="blue"
          icon={<Database className="w-5 h-5" />}
          compact
        />
        <AnimatedArrowDown />
        <DiagramNode
          title="Jira & Confluence"
          description="Live project data"
          color="indigo"
          icon={<Database className="w-5 h-5" />}
          compact
        />
      </div>
    </div>
  );
}

function DiagramNode({
  title,
  description,
  color,
  icon,
  highlighted,
  compact,
}: {
  title: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  highlighted?: boolean;
  compact?: boolean;
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', iconBg: 'bg-red-100' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100' },
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', iconBg: 'bg-indigo-100' },
  };

  const c = colorMap[color] ?? colorMap.blue;

  return (
    <div
      className={`
        flex flex-col items-center text-center rounded-xl border-2 transition-all
        ${c.bg} ${c.border}
        ${highlighted ? 'ring-2 ring-offset-2 ring-red-200 shadow-md' : ''}
        ${compact ? 'px-4 py-3 w-full max-w-[240px]' : 'px-4 py-4 w-[150px]'}
      `}
    >
      <div className={`w-10 h-10 rounded-lg ${c.iconBg} ${c.text} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <p className={`text-xs font-semibold ${c.text}`}>{title}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>
    </div>
  );
}

function AnimatedArrow() {
  return (
    <div className="flex items-center shrink-0 pt-4">
      <div className="w-8 h-px bg-gradient-to-r from-gray-300 to-gray-400 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-claude-orange/0 via-claude-orange/60 to-claude-orange/0 animate-pulse" />
      </div>
      <ArrowRight className="w-3 h-3 text-gray-400 -ml-0.5" />
    </div>
  );
}

function AnimatedArrowDown() {
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="w-px h-6 bg-gradient-to-b from-gray-300 to-gray-400 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-claude-orange/0 via-claude-orange/60 to-claude-orange/0 animate-pulse" />
      </div>
      <ArrowDown className="w-3 h-3 text-gray-400 -mt-0.5" />
    </div>
  );
}
