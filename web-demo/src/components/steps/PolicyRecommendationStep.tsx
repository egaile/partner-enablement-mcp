'use client';

import { useState } from 'react';
import {
  Shield,
  ArrowRight,
  CheckCircle2,
  FolderKanban,
} from 'lucide-react';
import type { RiskScoringData, PolicyRecommendation } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { SkeletonCard } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface PolicyRecommendationStepProps {
  data: RiskScoringData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

function severityVariant(severity: PolicyRecommendation['severity']): 'red' | 'amber' | 'green' {
  switch (severity) {
    case 'high':
      return 'red';
    case 'medium':
      return 'amber';
    case 'low':
      return 'green';
  }
}

export function PolicyRecommendationStep({ data, isGenerating, requestParams }: PolicyRecommendationStepProps) {
  const [applied, setApplied] = useState(false);
  const [applyAnimating, setApplyAnimating] = useState(false);

  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="policy_recommendations"
          narrativeKey="policy_recommendations"
          parameters={requestParams}
          isGenerating={isGenerating}
        />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { recommendations } = data;

  // Group recommendations by project
  const grouped = new Map<string, PolicyRecommendation[]>();
  for (const rec of recommendations) {
    const existing = grouped.get(rec.projectKey) ?? [];
    existing.push(rec);
    grouped.set(rec.projectKey, existing);
  }

  const uniqueProjects = new Set(recommendations.map((r) => r.projectKey));
  const uniqueTemplates = new Set(recommendations.map((r) => r.templateId));

  const handleApply = () => {
    setApplyAnimating(true);
    setTimeout(() => {
      setApplyAnimating(false);
      setApplied(true);
    }, 1500);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline
        toolName="policy_recommendations"
        narrativeKey="policy_recommendations"
        parameters={requestParams}
        isGenerating={isGenerating}
      />

      {/* Title */}
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-claude-orange" />
        <h3 className="text-lg font-semibold text-gray-900">Policy Recommendations</h3>
      </div>

      {/* Grouped Recommendations */}
      {Array.from(grouped.entries()).map(([projectKey, recs]) => {
        const projectName = recs[0].projectName;
        return (
          <div key={projectKey}>
            <div className="flex items-center gap-2 mb-3">
              <FolderKanban className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-gray-700">{projectName}</h4>
              <code className="text-[10px] font-mono text-gray-400">{projectKey}</code>
              <Badge variant="default">{recs.length} recommendation{recs.length !== 1 ? 's' : ''}</Badge>
            </div>
            <div className="space-y-2">
              {recs.map((rec, i) => (
                <Card
                  key={`${rec.projectKey}-${rec.templateId}-${i}`}
                  padding="sm"
                  className="!p-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Severity indicator */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      rec.severity === 'high'
                        ? 'bg-red-100'
                        : rec.severity === 'medium'
                          ? 'bg-amber-100'
                          : 'bg-green-100'
                    }`}>
                      <Shield className={`w-4 h-4 ${
                        rec.severity === 'high'
                          ? 'text-red-500'
                          : rec.severity === 'medium'
                            ? 'text-amber-500'
                            : 'text-green-500'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <Badge variant={severityVariant(rec.severity)}>{rec.severity}</Badge>
                        <span className="text-sm font-medium text-gray-900">{rec.projectName}</span>
                        <code className="text-[10px] font-mono text-gray-400">{rec.projectKey}</code>
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                        <Badge variant="purple">{rec.templateName}</Badge>
                      </div>
                      {/* Reason */}
                      <p className="text-sm text-gray-600 leading-relaxed">{rec.reason}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Summary */}
      <Card variant="highlighted" className="!p-4">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="font-medium text-gray-700">
            Based on compliance scanning, {uniqueTemplates.size} policy template{uniqueTemplates.size !== 1 ? 's' : ''}{' '}
            recommended across {uniqueProjects.size} project{uniqueProjects.size !== 1 ? 's' : ''}
          </span>
        </div>
      </Card>

      {/* Apply Button (cosmetic) */}
      {!applied ? (
        <button
          onClick={handleApply}
          disabled={applyAnimating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-claude-orange text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-70 disabled:cursor-wait"
        >
          {applyAnimating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Applying Policies...
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              Apply Recommended Policies
            </>
          )}
        </button>
      ) : (
        <Card className="border-green-200 bg-green-50/50 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">Policies Applied Successfully</p>
              <p className="text-xs text-green-600">
                {recommendations.length} policy rule{recommendations.length !== 1 ? 's' : ''}{' '}
                have been configured in the MCP Security Gateway.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
