'use client';

import { useState } from 'react';
import {
  LayoutGrid,
  BarChart3,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import type { RiskScoringData, ProjectRiskScore, RiskLevel } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { SkeletonCard, Skeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface RiskHeatmapStepProps {
  data: RiskScoringData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

const RISK_DIMENSIONS = [
  'PII Exposure',
  'Compliance Gaps',
  'Documentation Freshness',
  'Open Security Issues',
];

function levelColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'text-green-700';
    case 'medium':
      return 'text-amber-700';
    case 'high':
      return 'text-orange-700';
    case 'critical':
      return 'text-red-700';
  }
}

function levelBg(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'bg-green-100';
    case 'medium':
      return 'bg-amber-100';
    case 'high':
      return 'bg-orange-100';
    case 'critical':
      return 'bg-red-100';
  }
}

function levelBadgeVariant(level: RiskLevel): 'green' | 'amber' | 'orange' | 'red' {
  switch (level) {
    case 'low':
      return 'green';
    case 'medium':
      return 'amber';
    case 'high':
      return 'orange';
    case 'critical':
      return 'red';
  }
}

function levelBarColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'bg-green-400';
    case 'medium':
      return 'bg-amber-400';
    case 'high':
      return 'bg-orange-400';
    case 'critical':
      return 'bg-red-400';
  }
}

export function RiskHeatmapStep({ data, isGenerating, requestParams }: RiskHeatmapStepProps) {
  const [expandedCell, setExpandedCell] = useState<{ project: string; dimension: string } | null>(null);

  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="risk_heatmap"
          narrativeKey="risk_heatmap"
          parameters={requestParams}
          isGenerating={isGenerating}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { scores } = data;

  // Build a lookup: projectKey -> dimension name -> RiskDimension
  const dimensionLookup = new Map<string, Map<string, { score: number; level: RiskLevel; details: string }>>();
  for (const project of scores) {
    const dimMap = new Map<string, { score: number; level: RiskLevel; details: string }>();
    for (const dim of project.dimensions) {
      dimMap.set(dim.dimension, { score: dim.score, level: dim.level, details: dim.details });
    }
    dimensionLookup.set(project.key, dimMap);
  }

  const handleCellClick = (projectKey: string, dimension: string) => {
    if (expandedCell?.project === projectKey && expandedCell?.dimension === dimension) {
      setExpandedCell(null);
    } else {
      setExpandedCell({ project: projectKey, dimension });
    }
  };

  // Get expanded cell details
  const expandedDetails = expandedCell
    ? dimensionLookup.get(expandedCell.project)?.get(expandedCell.dimension)
    : null;

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline
        toolName="risk_heatmap"
        narrativeKey="risk_heatmap"
        parameters={requestParams}
        isGenerating={isGenerating}
      />

      {/* Heatmap Grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <LayoutGrid className="w-4 h-4 text-claude-orange" />
          <h4 className="text-sm font-semibold text-gray-700">Risk Heatmap</h4>
        </div>

        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 sticky left-0">
                  Dimension
                </th>
                {scores.map((project) => (
                  <th
                    key={project.key}
                    className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 min-w-[120px]"
                  >
                    <div>{project.name}</div>
                    <code className="text-[10px] font-mono text-gray-400 normal-case">{project.key}</code>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {RISK_DIMENSIONS.map((dimension) => (
                <tr key={dimension}>
                  <td className="px-4 py-3 text-xs font-medium text-gray-700 bg-gray-50/50 sticky left-0 whitespace-nowrap">
                    {dimension}
                  </td>
                  {scores.map((project) => {
                    const dim = dimensionLookup.get(project.key)?.get(dimension);
                    if (!dim) {
                      return (
                        <td key={project.key} className="px-4 py-3 text-center">
                          <span className="text-xs text-gray-300">--</span>
                        </td>
                      );
                    }
                    const isExpanded =
                      expandedCell?.project === project.key && expandedCell?.dimension === dimension;
                    return (
                      <td key={project.key} className="px-4 py-3">
                        <button
                          onClick={() => handleCellClick(project.key, dimension)}
                          className={`w-full rounded-lg px-3 py-2 transition-all cursor-pointer hover:ring-2 hover:ring-gray-300 ${levelBg(dim.level)} ${isExpanded ? 'ring-2 ring-claude-orange' : ''}`}
                        >
                          <span className={`text-lg font-bold ${levelColor(dim.level)}`}>
                            {dim.score}
                          </span>
                          <span className={`block text-[10px] font-medium ${levelColor(dim.level)}`}>
                            {dim.level}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Expanded Detail Panel */}
        {expandedDetails && expandedCell && (
          <Card className="mt-3 border-claude-orange/30 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{expandedCell.dimension}</span>
                  <code className="text-[10px] font-mono text-gray-400">{expandedCell.project}</code>
                  <Badge variant={levelBadgeVariant(expandedDetails.level)}>
                    Score: {expandedDetails.score}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{expandedDetails.details}</p>
              </div>
              <button
                onClick={() => setExpandedCell(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              >
                <ChevronDown className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </Card>
        )}
      </div>

      {/* Summary Bar — Overall risk per project */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-700">Overall Risk by Project</h4>
        </div>
        <div className="space-y-2">
          {scores.map((project) => (
            <Card key={project.key} padding="sm" className="!p-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-40 shrink-0">
                  <code className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                    {project.key}
                  </code>
                  <span className="text-sm text-gray-700 truncate">{project.name}</span>
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${levelBarColor(project.overallLevel)}`}
                      style={{ width: `${project.overallScore}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-bold font-mono ${levelColor(project.overallLevel)}`}>
                    {project.overallScore}
                  </span>
                  <Badge variant={levelBadgeVariant(project.overallLevel)}>
                    {project.overallLevel}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
