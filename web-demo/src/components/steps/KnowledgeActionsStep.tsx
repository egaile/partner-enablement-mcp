'use client';

import { useState } from 'react';
import {
  MessageSquare,
  Flag,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Play,
} from 'lucide-react';
import type { KnowledgeActionsData, KnowledgeActionResult } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';
import { WriteBlockedCallout } from '../SecurityCallout';

interface KnowledgeActionsStepProps {
  data: KnowledgeActionsData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
  onExecuteActions: (enabledActions: string[]) => void;
}

const ACTION_CONFIGS = [
  {
    type: 'footer_comment',
    label: 'Add Audit Summary',
    description: 'Post a knowledge base health summary as a footer comment',
    icon: MessageSquare,
    color: 'blue',
    toolName: 'createConfluenceFooterComment',
    isWrite: true,
  },
  {
    type: 'inline_comment',
    label: 'Flag Stale Sections',
    description: 'Add inline comments on outdated or low-quality sections',
    icon: Flag,
    color: 'amber',
    toolName: 'createConfluenceInlineComment',
    isWrite: true,
  },
  {
    type: 'update_page',
    label: 'Update Page Metadata',
    description: 'Update page labels and properties with audit results',
    icon: RefreshCw,
    color: 'purple',
    toolName: 'updateConfluencePage',
    isWrite: true,
  },
];

export function KnowledgeActionsStep({
  data,
  isGenerating,
  requestParams,
  onExecuteActions,
}: KnowledgeActionsStepProps) {
  const [enabledActions, setEnabledActions] = useState<Set<string>>(
    new Set(ACTION_CONFIGS.map((a) => a.type))
  );

  const toggleAction = (type: string) => {
    setEnabledActions((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleExecute = () => {
    onExecuteActions(Array.from(enabledActions));
  };

  // Show skeleton while generating with no data yet
  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="knowledge_actions"
          parameters={requestParams}
          isGenerating={isGenerating}
          isWriteOperation
        />
        <StepSkeleton />
      </div>
    );
  }

  // Pre-execution state: show action toggles
  if (!data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="knowledge_actions"
          parameters={requestParams}
          isGenerating={false}
          isWriteOperation
        />

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Knowledge Base Write Operations</h4>
          <p className="text-xs text-gray-500 mb-4">
            Select which audit actions the agent should execute. Write operations flow through the
            security gateway with policy enforcement and audit logging.
          </p>

          <div className="space-y-2">
            {ACTION_CONFIGS.map((action) => {
              const Icon = action.icon;
              const enabled = enabledActions.has(action.type);
              const iconColorMap: Record<string, string> = {
                blue: 'text-blue-500',
                amber: 'text-amber-500',
                purple: 'text-purple-500',
              };
              const bgColorMap: Record<string, string> = {
                blue: 'bg-blue-100',
                amber: 'bg-amber-100',
                purple: 'bg-purple-100',
              };

              return (
                <button
                  key={action.type}
                  onClick={() => toggleAction(action.type)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                    enabled
                      ? 'bg-white border-gray-300 hover:border-gray-400'
                      : 'bg-gray-50 border-gray-100 opacity-60 hover:opacity-80'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      enabled ? bgColorMap[action.color] : 'bg-gray-100'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${enabled ? iconColorMap[action.color] : 'text-gray-400'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{action.label}</p>
                    <p className="text-xs text-gray-500">{action.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <code className="text-[10px] font-mono text-gray-400 hidden sm:block">
                      {action.toolName}
                    </code>
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        enabled ? 'bg-claude-orange border-claude-orange' : 'border-gray-300'
                      }`}
                    >
                      {enabled && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleExecute}
            disabled={enabledActions.size === 0}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-claude-orange text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Execute {enabledActions.size} Action{enabledActions.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    );
  }

  // Post-execution: show results
  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline
        toolName="knowledge_actions"
        parameters={requestParams}
        isGenerating={false}
        isWriteOperation
      />

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Action Results</h4>
        <div className="space-y-3">
          {data.actions.map((action, i) => (
            <ActionResultCard key={i} action={action} index={i} />
          ))}
        </div>
      </div>

      {/* Security callout for blocked operations */}
      {data.actions.some((a) => a.policyBlocked) && <WriteBlockedCallout />}

      {/* Summary */}
      <Card variant="highlighted" className="!p-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="font-medium text-gray-700">
              {data.actions.filter((a) => a.success).length} succeeded
            </span>
          </div>
          {data.actions.some((a) => a.policyBlocked) && (
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span className="font-medium text-gray-700">
                {data.actions.filter((a) => a.policyBlocked).length} blocked
              </span>
            </div>
          )}
          {data.actions.some((a) => a.approvalRequired) && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-gray-700">
                {data.actions.filter((a) => a.approvalRequired).length} pending approval
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function ActionResultCard({ action, index }: { action: KnowledgeActionResult; index: number }) {
  const config = ACTION_CONFIGS.find((c) => c.type === action.type);
  const Icon = config?.icon ?? MessageSquare;
  const iconColorMap: Record<string, string> = {
    blue: 'text-blue-500',
    amber: 'text-amber-500',
    purple: 'text-purple-500',
  };
  const bgColorMap: Record<string, string> = {
    blue: 'bg-blue-100',
    amber: 'bg-amber-100',
    purple: 'bg-purple-100',
  };
  const iconColor = config ? iconColorMap[config.color] : 'text-blue-500';
  const iconBg = config ? bgColorMap[config.color] : 'bg-blue-100';

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition-all animate-fade-in ${
        action.success
          ? 'bg-green-50/50 border-green-200'
          : action.policyBlocked
            ? 'bg-red-50/50 border-red-200'
            : action.approvalRequired
              ? 'bg-amber-50/50 border-amber-200'
              : 'bg-gray-50 border-gray-200'
      }`}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {/* Icon */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900">{action.description}</p>
            <code className="text-[10px] font-mono text-gray-400">{action.toolUsed}</code>
          </div>
          <div className="shrink-0">
            {action.success && <Badge variant="green">Success</Badge>}
            {action.policyBlocked && <Badge variant="red">Blocked</Badge>}
            {action.approvalRequired && <Badge variant="amber">Approval</Badge>}
            {!action.success && !action.policyBlocked && !action.approvalRequired && (
              <Badge variant="gray">Failed</Badge>
            )}
          </div>
        </div>

        {/* Policy block explanation */}
        {action.policyBlocked && action.blockReason && (
          <div className="mt-2 bg-red-100/50 rounded-md px-3 py-2">
            <p className="text-xs text-red-700">{action.blockReason}</p>
            <p className="text-[10px] text-gray-500 mt-1 italic">
              This demonstrates the MCP Gateway enforcing write-protection policies on Confluence.
            </p>
          </div>
        )}

        {/* Approval required explanation */}
        {action.approvalRequired && action.blockReason && (
          <div className="mt-2 bg-amber-100/50 rounded-md px-3 py-2">
            <p className="text-xs text-amber-700">{action.blockReason}</p>
            <p className="text-[10px] text-gray-500 mt-1 italic">
              This demonstrates the human-in-the-loop approval workflow.
            </p>
          </div>
        )}

        {/* Success details */}
        {action.success && action.details && (
          <ActionDetails details={action.details} actionType={action.type} />
        )}
      </div>
    </div>
  );
}

function ActionDetails({
  details,
  actionType,
}: {
  details: Record<string, unknown>;
  actionType: string;
}) {
  const pageTitle = details.pageTitle as string | undefined;
  const commentId = details.commentId as string | undefined;
  const flaggedSections = details.flaggedSections as number | undefined;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {pageTitle && <Badge variant="purple">{pageTitle}</Badge>}
      {commentId && <Badge variant="blue">#{commentId}</Badge>}
      {actionType === 'inline_comment' && flaggedSections !== undefined && (
        <Badge variant="amber">{flaggedSections} sections flagged</Badge>
      )}
      {actionType === 'update_page' && <Badge variant="green">Metadata updated</Badge>}
    </div>
  );
}
