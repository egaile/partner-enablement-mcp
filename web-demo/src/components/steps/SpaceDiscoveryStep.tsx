'use client';

import { Globe, FileText, Calendar, Hash } from 'lucide-react';
import type { SpaceDiscoveryData } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface SpaceDiscoveryStepProps {
  data: SpaceDiscoveryData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function SpaceDiscoveryStep({ data, isGenerating, requestParams }: SpaceDiscoveryStepProps) {
  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="getConfluenceSpaces"
          narrativeKey="space_discovery"
          parameters={requestParams}
          isGenerating={isGenerating}
        />
        <StepSkeleton />
      </div>
    );
  }

  if (!data) return null;

  const { selectedSpace, pages } = data;

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline
        toolName="getConfluenceSpaces"
        narrativeKey="space_discovery"
        parameters={requestParams}
        isGenerating={isGenerating}
      />

      {/* Selected Space Info */}
      <Card variant="highlighted">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedSpace.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <code className="text-xs font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                  {selectedSpace.key}
                </code>
                <Badge variant="purple">{selectedSpace.type}</Badge>
              </div>
            </div>
          </div>
          <Badge variant="green" size="md">
            {data.source === 'gateway' ? 'Live Data' : 'Mock'}
          </Badge>
        </div>
        {selectedSpace.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{selectedSpace.description}</p>
        )}
      </Card>

      {/* Summary Bar */}
      <Card variant="highlighted" className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">{pages.length} Pages</span>
        </div>
        <div className="h-4 w-px bg-gray-300" />
        <div className="flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-600">
            Space Key: <code className="font-mono text-purple-600">{selectedSpace.key}</code>
          </span>
        </div>
        <div className="h-4 w-px bg-gray-300" />
        <span className="text-xs text-gray-600">
          {pages.filter((p) => p.status === 'current').length} current,{' '}
          {pages.filter((p) => p.status !== 'current').length} other
        </span>
      </Card>

      {/* Page Grid */}
      {pages.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Discovered Pages</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pages.map((page) => (
              <Card key={page.id} padding="sm" className="!p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">
                      {page.title}
                    </p>
                  </div>
                  <Badge
                    variant={page.status === 'current' ? 'green' : 'gray'}
                  >
                    {page.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
                  {page.lastModified && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      {new Date(page.lastModified).toLocaleDateString()}
                    </span>
                  )}
                  {page.authorName && (
                    <span className="truncate max-w-[120px]">{page.authorName}</span>
                  )}
                  {page.version !== undefined && (
                    <span>v{page.version}</span>
                  )}
                  {page.wordCount !== undefined && (
                    <span>{page.wordCount.toLocaleString()} words</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
