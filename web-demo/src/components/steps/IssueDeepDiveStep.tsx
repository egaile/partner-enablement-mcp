'use client';

import { useState } from 'react';
import {
  Activity,
  Ban,
  Clock,
  ChevronDown,
  ChevronRight,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import type { IssueDeepDiveData, IssueDeepDiveIssue } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge, PriorityBadge, StatusBadge, TypeBadge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface IssueDeepDiveStepProps {
  data: IssueDeepDiveData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function IssueDeepDiveStep({ data, isGenerating, requestParams }: IssueDeepDiveStepProps) {
  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="issue_deep_dive"
          parameters={requestParams}
          isGenerating={isGenerating}
        />
        <StepSkeleton />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline
        toolName="issue_deep_dive"
        parameters={requestParams}
        isGenerating={isGenerating}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <MetricTile
          icon={<Activity className="w-4 h-4 text-blue-500" />}
          label="In Progress"
          value={data.totalInProgress}
        />
        <MetricTile
          icon={<Ban className="w-4 h-4 text-red-500" />}
          label="Blocked"
          value={data.totalBlocked}
          alert={data.totalBlocked > 0}
        />
        <MetricTile
          icon={<Clock className="w-4 h-4 text-purple-500" />}
          label="Time Spent"
          value={data.totalTimeSpent}
        />
      </div>

      {/* Issue Cards */}
      {data.issues.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">
              Sprint Issues ({data.issues.length})
            </h4>
            <span className="text-[10px] text-gray-400 font-mono">
              via getJiraIssue + getJiraIssueRemoteIssueLinks
            </span>
          </div>
          <div className="space-y-2">
            {data.issues.map((issue) => (
              <IssueCard key={issue.key} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {/* Link Types Reference */}
      {data.linkTypes.length > 0 && (
        <Card padding="sm" className="!p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Available Link Types
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {data.linkTypes.map((lt) => (
              <Badge key={lt.id} variant="gray">{lt.name}</Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  alert?: boolean;
}) {
  return (
    <Card className={`!p-4 text-center ${alert ? 'border-red-200 bg-red-50/30' : ''}`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className={`text-2xl font-bold ${alert ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Card>
  );
}

function IssueCard({ issue }: { issue: IssueDeepDiveIssue }) {
  const [expanded, setExpanded] = useState(false);
  const hasLinks = issue.issueLinks.length > 0;
  const hasRemoteLinks = issue.remoteLinks.length > 0;
  const isExpandable = hasLinks || hasRemoteLinks;

  return (
    <div
      className={`bg-white rounded-lg border transition-colors ${
        expanded ? 'border-blue-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <button
        onClick={() => isExpandable && setExpanded(!expanded)}
        className={`w-full flex items-start gap-3 px-4 py-3 text-left ${
          isExpandable ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="shrink-0 mt-0.5 flex items-center gap-1.5">
          {isExpandable ? (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            )
          ) : (
            <div className="w-3.5" />
          )}
          <TypeBadge type={issue.type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <code className="text-xs font-mono text-blue-600">{issue.key}</code>
              <p className="text-sm font-medium text-gray-900 leading-snug">{issue.summary}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <PriorityBadge priority={issue.priority} />
              <StatusBadge status={issue.status} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            {issue.assignee && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <User className="w-3 h-3 text-gray-400" />
                {issue.assignee}
              </span>
            )}
            {issue.timeSpent && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3 text-gray-400" />
                {issue.timeSpent}
              </span>
            )}
            {issue.updated && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar className="w-3 h-3" />
                {new Date(issue.updated).toLocaleDateString()}
              </span>
            )}
            {issue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {issue.labels.map((label) => (
                  <Badge key={label} variant="gray">{label}</Badge>
                ))}
              </div>
            )}
            {hasLinks && (
              <Badge variant="blue">{issue.issueLinks.length} link{issue.issueLinks.length !== 1 ? 's' : ''}</Badge>
            )}
            {hasRemoteLinks && (
              <Badge variant="purple">{issue.remoteLinks.length} remote</Badge>
            )}
          </div>
        </div>
      </button>

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3 ml-[52px] space-y-3 animate-fade-in">
          {/* Issue Links */}
          {hasLinks && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Issue Links
              </p>
              <div className="space-y-1.5">
                {issue.issueLinks.map((link, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2"
                  >
                    {link.direction === 'outward' ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    ) : (
                      <ArrowDownLeft className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    )}
                    <span className="text-xs text-gray-500">{link.type}</span>
                    <code className="text-xs font-mono text-blue-600">{link.linkedIssueKey}</code>
                    <span className="text-xs text-gray-700 flex-1 truncate">
                      {link.linkedIssueSummary}
                    </span>
                    <StatusBadge status={link.linkedIssueStatus} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remote Links */}
          {hasRemoteLinks && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Remote Links
              </p>
              <div className="space-y-1.5">
                {issue.remoteLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2 hover:bg-gray-100 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span className="text-xs text-gray-700 flex-1 truncate">{link.title}</span>
                    <span className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">
                      {link.url}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-400 font-mono">
            Fetched via getJiraIssue + getJiraIssueRemoteIssueLinks
          </p>
        </div>
      )}
    </div>
  );
}
