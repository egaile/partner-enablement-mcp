import { FileText, AlertCircle } from 'lucide-react';
import type { ProjectContextData, Issue } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge, PriorityBadge, StatusBadge, TypeBadge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { ToolNarrative } from '../ToolNarrative';

interface ContextStepProps {
  data: ProjectContextData | null;
  isGenerating: boolean;
  projectKey: string;
  industry: string;
  requestParams: Record<string, unknown>;
}

export function ContextStep({ data, isGenerating, projectKey, industry, requestParams }: ContextStepProps) {
  if (isGenerating && !data) return <StepSkeleton />;
  if (!data) return null;

  const { project, issues, detectedCompliance, detectedIntegrations, detectedDataTypes, summary } = data;

  return (
    <div className="space-y-5 animate-fade-in">
      <ToolNarrative toolName="read_project_context" parameters={requestParams} />

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
          <h4 className="text-sm font-semibold text-gray-700">Backlog Issues</h4>
          <div className="grid gap-2">
            {issues.map((issue) => (
              <IssueCard key={issue.key} issue={issue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  return (
    <div className="flex items-start gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3 hover:border-gray-300 transition-colors">
      <div className="shrink-0 mt-0.5">
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
    </div>
  );
}
