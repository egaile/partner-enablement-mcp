'use client';

import { FolderTree, FileText, Calendar, AlertTriangle, Layers, GitBranch } from 'lucide-react';
import type { PageTreeData, PageTreeNode } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface PageTreeStepProps {
  data: PageTreeData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function PageTreeStep({ data, isGenerating, requestParams }: PageTreeStepProps) {
  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="getConfluencePageDescendants"
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
        toolName="getConfluencePageDescendants"
        parameters={requestParams}
        isGenerating={isGenerating}
      />

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile
          icon={<FileText className="w-4 h-4 text-purple-500" />}
          label="Total Pages"
          value={data.totalPages}
        />
        <MetricTile
          icon={<Layers className="w-4 h-4 text-blue-500" />}
          label="Max Depth"
          value={data.maxDepth}
        />
        <MetricTile
          icon={<GitBranch className="w-4 h-4 text-green-500" />}
          label="Root Pages"
          value={data.rootPages.length}
        />
        <MetricTile
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          label="Orphan Pages"
          value={data.orphanCount}
          alert={data.orphanCount > 0}
        />
      </div>

      {/* Page Tree */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FolderTree className="w-4 h-4 text-purple-500" />
          <h4 className="text-sm font-semibold text-gray-700">Page Hierarchy</h4>
          <Badge variant="purple">
            {data.source === 'gateway' ? 'Live' : 'Mock'}
          </Badge>
        </div>
        <Card padding="sm" className="!p-4">
          <div className="space-y-0.5">
            {data.rootPages.map((node) => (
              <TreeNode key={node.page.id} node={node} pageDetails={data.pageDetails} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TreeNode({
  node,
  pageDetails,
}: {
  node: PageTreeNode;
  pageDetails: Record<string, { wordCount: number; lastModified?: string }>;
}) {
  const detail = pageDetails[node.page.id];
  const wordCount = detail?.wordCount ?? node.page.wordCount;
  const lastModified = detail?.lastModified ?? node.page.lastModified;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 transition-colors group"
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
      >
        {/* Indent indicator */}
        {node.depth > 0 && (
          <span className="text-gray-300 text-xs font-mono select-none" aria-hidden>
            {'|'.padStart(1)}
          </span>
        )}

        {/* Icon */}
        {hasChildren ? (
          <FolderTree className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        )}

        {/* Title */}
        <span className="text-sm text-gray-900 font-medium flex-1 min-w-0 truncate">
          {node.page.title}
        </span>

        {/* Meta */}
        <div className="flex items-center gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {wordCount !== undefined && (
            <span className="text-[10px] text-gray-400 font-mono">
              {wordCount.toLocaleString()} words
            </span>
          )}
          {lastModified && (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Calendar className="w-2.5 h-2.5" />
              {new Date(lastModified).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Depth badge always visible */}
        <Badge variant="gray">L{node.depth}</Badge>
      </div>

      {/* Children */}
      {hasChildren && (
        <div className="border-l border-gray-100" style={{ marginLeft: `${node.depth * 20 + 20}px` }}>
          {node.children.map((child) => (
            <TreeNode key={child.page.id} node={child} pageDetails={pageDetails} />
          ))}
        </div>
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
