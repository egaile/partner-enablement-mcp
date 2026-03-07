'use client';

import { useState } from 'react';
import {
  Tag,
  MessageSquare,
  ArrowRightCircle,
  FileText,
  Ticket,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Play,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import type { AgentActionsData, ActionResult } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';
import { WriteBlockedCallout } from '../SecurityCallout';

interface ActionsStepProps {
  data: AgentActionsData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
  onExecuteActions: (enabledActions: string[]) => void;
}

const ACTION_CONFIGS = [
  {
    type: 'label_issues',
    label: 'Label Issues',
    description: 'Add "ai-deployment" and "compliance-review" labels',
    icon: Tag,
    color: 'blue',
    toolName: 'editJiraIssue',
    isWrite: true,
  },
  {
    type: 'add_comment',
    label: 'Add Analysis Comment',
    description: 'Post AI deployment summary on a key issue',
    icon: MessageSquare,
    color: 'blue',
    toolName: 'addCommentToJiraIssue',
    isWrite: true,
  },
  {
    type: 'transition_issue',
    label: 'Transition Issue',
    description: 'Move a setup task to "In Progress"',
    icon: ArrowRightCircle,
    color: 'blue',
    toolName: 'transitionJiraIssue',
    isWrite: true,
  },
  {
    type: 'create_confluence',
    label: 'Create Confluence Doc',
    description: 'Publish architecture documentation',
    icon: FileText,
    color: 'purple',
    toolName: 'createConfluencePage',
    isWrite: true,
  },
  {
    type: 'create_jira',
    label: 'Create Jira Tickets',
    description: 'Create implementation tickets from plan',
    icon: Ticket,
    color: 'blue',
    toolName: 'createJiraIssue',
    isWrite: true,
  },
];

export function ActionsStep({
  data,
  isGenerating,
  requestParams,
  onExecuteActions,
}: ActionsStepProps) {
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
          toolName="agent_actions"
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
          toolName="agent_actions"
          parameters={requestParams}
          isGenerating={false}
          isWriteOperation
        />

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Agent Write Operations</h4>
          <p className="text-xs text-gray-500 mb-4">
            Select which actions the agent should execute. Write operations flow through the security
            gateway with policy enforcement and audit logging.
          </p>

          <div className="space-y-2">
            {ACTION_CONFIGS.map((action) => {
              const Icon = action.icon;
              const enabled = enabledActions.has(action.type);
              const iconColor = action.color === 'purple' ? 'text-purple-500' : 'text-blue-500';

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
                      enabled
                        ? action.color === 'purple'
                          ? 'bg-purple-100'
                          : 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${enabled ? iconColor : 'text-gray-400'}`} />
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
        toolName="agent_actions"
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

function ActionResultCard({ action, index }: { action: ActionResult; index: number }) {
  const config = ACTION_CONFIGS.find((c) => c.type === action.type);
  const Icon = config?.icon ?? Tag;
  const iconColor = config?.color === 'purple' ? 'text-purple-500' : 'text-blue-500';
  const iconBg = config?.color === 'purple' ? 'bg-purple-100' : 'bg-blue-100';

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
      {/* Timeline dot */}
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
              This demonstrates the MCP Gateway enforcing write-protection policies.
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
          <ActionDetails details={action.details} />
        )}
      </div>
    </div>
  );
}

function ActionDetails({ details }: { details: Record<string, unknown> }) {
  const labels = details.labels as string[] | undefined;
  const newStatus = details.newStatus as string | undefined;
  const pageUrl = details.pageUrl as string | undefined;
  const issues = details.issues as Array<{ key: string }> | undefined;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {labels && labels.map((label) => (
        <Badge key={label} variant="blue">{label}</Badge>
      ))}
      {newStatus && (
        <Badge variant="green">{newStatus}</Badge>
      )}
      {pageUrl && (
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
        >
          Open in Confluence <ExternalLink className="w-3 h-3" />
        </a>
      )}
      {issues && issues.map((issue) => (
        <Badge key={issue.key} variant="blue">{issue.key}</Badge>
      ))}
    </div>
  );
}
