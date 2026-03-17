'use client';

import { Activity, CheckCircle2, AlertTriangle, Clock, XCircle, Lightbulb } from 'lucide-react';
import type { HealthScoringData, PageHealthScore } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface HealthScoringStepProps {
  data: HealthScoringData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  if (score >= 25) return 'text-orange-600';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  if (score >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function statusVariant(status: string): 'green' | 'amber' | 'orange' | 'red' {
  switch (status) {
    case 'healthy':
      return 'green';
    case 'needs-attention':
      return 'amber';
    case 'stale':
      return 'orange';
    case 'critical':
      return 'red';
    default:
      return 'green';
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'needs-attention':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'stale':
      return <Clock className="w-4 h-4 text-orange-500" />;
    case 'critical':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Activity className="w-4 h-4 text-gray-500" />;
  }
}

export function HealthScoringStep({ data, isGenerating, requestParams }: HealthScoringStepProps) {
  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="knowledge_health_scoring"
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
        toolName="knowledge_health_scoring"
        parameters={requestParams}
        isGenerating={isGenerating}
      />

      {/* Average Score Header */}
      <Card variant="highlighted" className="text-center !py-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Average Knowledge Health Score
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className={`text-5xl font-bold ${scoreColor(data.averageScore)}`}>
            {data.averageScore}
          </span>
          <div className="text-left">
            <Badge
              variant={data.averageScore >= 75 ? 'green' : data.averageScore >= 50 ? 'amber' : 'red'}
              size="md"
            >
              {data.averageScore >= 75 ? 'Good' : data.averageScore >= 50 ? 'Fair' : 'Poor'}
            </Badge>
            <p className="text-xs text-gray-500 mt-0.5">out of 100</p>
          </div>
        </div>
      </Card>

      {/* Status Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile
          icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
          label="Healthy"
          value={data.healthyCount}
        />
        <MetricTile
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          label="Needs Attention"
          value={data.needsAttentionCount}
          alert={data.needsAttentionCount > 0}
        />
        <MetricTile
          icon={<Clock className="w-4 h-4 text-orange-500" />}
          label="Stale"
          value={data.staleCount}
          alert={data.staleCount > 0}
        />
        <MetricTile
          icon={<XCircle className="w-4 h-4 text-red-500" />}
          label="Critical"
          value={data.criticalCount}
          alert={data.criticalCount > 0}
        />
      </div>

      {/* Page Health Score Cards */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Page Health Scores</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.pageScores.map((page) => (
            <PageHealthCard key={page.pageId} page={page} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PageHealthCard({ page }: { page: PageHealthScore }) {
  return (
    <Card padding="sm" className="!p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          {statusIcon(page.status)}
          <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">
            {page.title}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-lg font-bold ${scoreColor(page.score)}`}>
            {page.score}
          </span>
          <Badge variant={statusVariant(page.status)}>{page.status}</Badge>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="space-y-2 mb-3">
        <FactorBar label="Staleness" value={page.factors.staleness} />
        <FactorBar label="Depth" value={page.factors.depth} />
        <FactorBar label="Comments" value={page.factors.commentActivity} />
        <FactorBar label="Word Count" value={page.factors.wordCount} />
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Has Children</span>
          <Badge variant={page.factors.hasChildren ? 'green' : 'gray'}>
            {page.factors.hasChildren ? 'Yes' : 'No'}
          </Badge>
        </div>
      </div>

      {/* Recommendations */}
      {page.recommendations.length > 0 && (
        <div className="border-t border-gray-100 pt-2">
          <div className="flex items-center gap-1 mb-1.5">
            <Lightbulb className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Recommendations
            </span>
          </div>
          <ul className="space-y-1">
            {page.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                <span className="text-gray-300 mt-0.5 shrink-0">-</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  // value is 0-100 representing the factor's contribution
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBg(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-gray-400 w-7 text-right">{clamped}</span>
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
  value: number;
  alert?: boolean;
}) {
  return (
    <Card className={`!p-4 text-center ${alert ? 'border-amber-200 bg-amber-50/30' : ''}`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className={`text-2xl font-bold ${alert ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Card>
  );
}
