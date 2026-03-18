'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { PolicyTemplate } from '@/types/api';

interface PolicyTemplateCardProps {
  template: PolicyTemplate;
  isActive: boolean;
  onToggle: (id: string) => void;
}

const CATEGORY_VARIANT: Record<string, 'blue' | 'red' | 'amber'> = {
  access: 'blue',
  security: 'red',
  compliance: 'amber',
};

const ACTION_VARIANT: Record<string, 'green' | 'red' | 'amber' | 'blue'> = {
  allow: 'green',
  deny: 'red',
  require_approval: 'amber',
  log_only: 'blue',
};

const ACTION_LABEL: Record<string, string> = {
  allow: 'Allow',
  deny: 'Deny',
  require_approval: 'Approval',
  log_only: 'Log Only',
};

export function PolicyTemplateCard({ template, isActive, onToggle }: PolicyTemplateCardProps) {
  const [expanded, setExpanded] = useState(false);

  const categoryVariant = CATEGORY_VARIANT[template.category] ?? 'blue';

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-200 ${
        isActive
          ? 'border-claude-orange/40 bg-orange-50/40 shadow-md shadow-orange-500/10'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Top row: category badge + toggle */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <Badge variant={categoryVariant}>
          {template.category}
        </Badge>

        {/* Toggle switch */}
        <button
          onClick={() => onToggle(template.id)}
          className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none"
          style={{ backgroundColor: isActive ? '#22c55e' : '#d1d5db' }}
          role="switch"
          aria-checked={isActive}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        </button>
      </div>

      {/* Name & description */}
      <h4 className="text-sm font-semibold text-gray-900 mb-1">{template.name}</h4>
      <p className="text-xs text-gray-500 leading-relaxed">{template.description}</p>

      {/* Expandable rules (only when active) */}
      {isActive && (
        <div className="mt-3 animate-fade-in">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
            {template.rules.length} rule{template.rules.length !== 1 ? 's' : ''}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 animate-fade-in">
              {template.rules.map((rule, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs p-2 bg-white/80 rounded-lg border border-gray-100"
                >
                  <Badge variant={ACTION_VARIANT[rule.action] ?? 'gray'}>
                    {ACTION_LABEL[rule.action] ?? rule.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 font-medium">{rule.name}</p>
                    {rule.conditions.tools && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.conditions.tools.map((pattern, j) => (
                          <code
                            key={j}
                            className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono"
                          >
                            {pattern}
                          </code>
                        ))}
                      </div>
                    )}
                    {rule.conditions.servers && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.conditions.servers.map((pattern, j) => (
                          <code
                            key={j}
                            className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono"
                          >
                            {pattern}
                          </code>
                        ))}
                      </div>
                    )}
                    {rule.modifiers && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.modifiers.redactPII && (
                          <Badge variant="purple">PII Redaction</Badge>
                        )}
                        {rule.modifiers.maxCallsPerMinute && (
                          <Badge variant="gray">{rule.modifiers.maxCallsPerMinute}/min</Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
