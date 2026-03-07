'use client';

import { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, User, Calendar, MessageSquare, Loader2 } from 'lucide-react';
import type { ProjectContextData, Issue } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge, PriorityBadge, StatusBadge, TypeBadge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface IssueDetail {
  key: string;
  summary: string;
  description?: string;
  type: string;
  status: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  created?: string;
  updated?: string;
  labels: string[];
  components: string[];
  commentCount?: number;
}

interface ContextStepProps {
  data: ProjectContextData | null;
  isGenerating: boolean;
  projectKey: string;
  industry: string;
  requestParams: Record<string, unknown>;
}

export function ContextStep({ data, isGenerating, projectKey, industry, requestParams }: ContextStepProps) {
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [issueDetails, setIssueDetails] = useState<Record<string, IssueDetail>>({});
  const [loadingIssue, setLoadingIssue] = useState<string | null>(null);

  if (isGenerating && !data) return <StepSkeleton />;
  if (!data) return null;

  const { project, issues, detectedCompliance, detectedIntegrations, detectedDataTypes, summary } = data;

  const handleToggleIssue = async (issueKey: string) => {
    if (expandedIssue === issueKey) {
      setExpandedIssue(null);
      return;
    }

    setExpandedIssue(issueKey);

    // Fetch details if not already cached
    if (!issueDetails[issueKey]) {
      setLoadingIssue(issueKey);
      try {
        const res = await fetch('/api/tools/issue-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueKey }),
        });
        if (res.ok) {
          const detail = await res.json();
          setIssueDetails((prev) => ({ ...prev, [issueKey]: detail }));
        }
      } catch {
        // Silently fail — just show the basic info
      } finally {
        setLoadingIssue(null);
      }
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline toolName="read_project_context" parameters={requestParams} isGenerating={isGenerating} />

      {/* Project Header */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <code className="text-sm font-mono font-semibold text-claude-orange">{project.key}</code>
              <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
            </div>
            {project.lead && (
              <p className="text-sm text-gray-500">Lead: {project.lead}</p>
            )}
          </div>
          <Badge variant="green" size="md">Live Data</Badge>
        </div>
        {project.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{project.description}</p>
        )}
      </Card>

      {/* Detected Signals */}
      {(detectedCompliance.length > 0 || detectedIntegrations.length > 0 || detectedDataTypes.length > 0) && (
        <div className="grid sm:grid-cols-3 gap-4">
          {detectedCompliance.length > 0 && (
            <Card className="space-y-2">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Compliance Signals</p>
              <div className="flex flex-wrap gap-1.5">
                {detectedCompliance.map((c) => (
                  <Badge key={c} variant="red">{c}</Badge>
                ))}
              </div>
            </Card>
          )}
          {detectedIntegrations.length > 0 && (
            <Card className="space-y-2">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Integration Targets</p>
              <div className="flex flex-wrap gap-1.5">
                {detectedIntegrations.map((i) => (
                  <Badge key={i} variant="blue">{i}</Badge>
                ))}
              </div>
            </Card>
          )}
          {detectedDataTypes.length > 0 && (
            <Card className="space-y-2">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Data Types</p>
              <div className="flex flex-wrap gap-1.5">
                {detectedDataTypes.map((d) => (
                  <Badge key={d} variant="purple">{d}</Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Issue Summary Bar */}
      <Card variant="highlighted" className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">{summary.totalIssues} Issues</span>
        </div>
        <div className="h-4 w-px bg-gray-300" />
        {Object.entries(summary.byType).map(([type, count]) => (
          <span key={type} className="text-xs text-gray-600">
            {count} {type}{count > 1 ? 's' : ''}
          </span>
        ))}
        <div className="h-4 w-px bg-gray-300" />
        {Object.entries(summary.byStatus).map(([status, count]) => (
          <span key={status} className="text-xs text-gray-600">
            {count} {status}
          </span>
        ))}
      </Card>

      {/* Issue Cards */}
      {issues.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Backlog Issues</h4>
            <span className="text-[10px] text-gray-400 font-mono">Click to expand via getJiraIssue</span>
          </div>
          <div className="grid gap-2">
            {issues.map((issue) => (
              <IssueCard
                key={issue.key}
                issue={issue}
                isExpanded={expandedIssue === issue.key}
                isLoading={loadingIssue === issue.key}
                detail={issueDetails[issue.key] ?? null}
                onToggle={() => handleToggleIssue(issue.key)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IssueCard({
  issue,
  isExpanded,
  isLoading,
  detail,
  onToggle,
}: {
  issue: Issue;
  isExpanded: boolean;
  isLoading: boolean;
  detail: IssueDetail | null;
  onToggle: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-lg border transition-colors ${
        isExpanded ? 'border-blue-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <div className="shrink-0 mt-0.5 flex items-center gap-1.5">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
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
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {issue.labels.map((label) => (
                <Badge key={label} variant="gray">{label}</Badge>
              ))}
            </div>
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3 ml-[52px]">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Fetching via getJiraIssue...
            </div>
          ) : detail ? (
            <IssueDetailView detail={detail} />
          ) : (
            <p className="text-xs text-gray-400 italic">No additional details available</p>
          )}
        </div>
      )}
    </div>
  );
}

function IssueDetailView({ detail }: { detail: IssueDetail }) {
  return (
    <div className="space-y-3 animate-fade-in">
      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600">
        {detail.assignee && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3 text-gray-400" />
            {detail.assignee}
          </span>
        )}
        {detail.reporter && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3 text-gray-300" />
            <span className="text-gray-400">Reporter:</span> {detail.reporter}
          </span>
        )}
        {detail.commentCount !== undefined && detail.commentCount > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-gray-400" />
            {detail.commentCount} comment{detail.commentCount !== 1 ? 's' : ''}
          </span>
        )}
        {detail.created && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gray-400" />
            {new Date(detail.created).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Components */}
      {detail.components.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {detail.components.map((comp) => (
            <Badge key={comp} variant="blue">{comp}</Badge>
          ))}
        </div>
      )}

      {/* Description */}
      {detail.description && (
        <div className="bg-gray-50 rounded-md px-3 py-2">
          <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-6">
            {detail.description}
          </p>
        </div>
      )}

      {/* Tool indicator */}
      <p className="text-[10px] text-gray-400 font-mono">
        Fetched via getJiraIssue
      </p>
    </div>
  );
}
