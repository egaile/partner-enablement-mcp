'use client';

import {
  Search,
  ShieldAlert,
  Tag,
  FileText,
  Bug,
  BarChart3,
} from 'lucide-react';
import type { ComplianceScanData, ComplianceHit } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface ComplianceScanStepProps {
  data: ComplianceScanData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

const KEYWORD_COLORS: Record<string, 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'purple' | 'gray'> = {
  PHI: 'red',
  PII: 'red',
  HIPAA: 'purple',
  SOC2: 'amber',
  PCI: 'orange',
  FERPA: 'blue',
  FedRAMP: 'green',
  encryption: 'gray',
  patient: 'red',
  'credit card': 'orange',
  SSN: 'red',
  'social security': 'red',
  GDPR: 'purple',
  password: 'red',
  'access control': 'amber',
  audit: 'blue',
  compliance: 'green',
  security: 'amber',
};

function keywordVariant(keyword: string): 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'purple' | 'gray' {
  const lower = keyword.toLowerCase();
  for (const [key, variant] of Object.entries(KEYWORD_COLORS)) {
    if (lower.includes(key.toLowerCase())) return variant;
  }
  return 'gray';
}

export function ComplianceScanStep({ data, isGenerating, requestParams }: ComplianceScanStepProps) {
  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="searchJiraIssuesUsingJql"
          narrativeKey="compliance_scan_jira"
          parameters={requestParams}
          isGenerating={isGenerating}
        />
        {/* Pulsing scan indicator */}
        <Card className="!p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { hits, scansByProject, scansByKeyword } = data;

  // Find max count for proportional bar widths
  const maxProjectCount = Math.max(...Object.values(scansByProject), 1);

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline
        toolName="searchJiraIssuesUsingJql"
        narrativeKey="compliance_scan_jira"
        parameters={requestParams}
        isGenerating={isGenerating}
      />
      <SecurityPipeline
        toolName="searchConfluenceUsingCql"
        narrativeKey="compliance_scan_confluence"
        parameters={{}}
        isGenerating={false}
      />

      {/* Keyword Summary Row */}
      <Card variant="highlighted">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-claude-orange" />
          <h4 className="text-sm font-semibold text-gray-700">Keyword Hits</h4>
          <Badge variant="default" size="md">{hits.length} total</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(scansByKeyword)
            .sort(([, a], [, b]) => b - a)
            .map(([keyword, count]) => (
              <Badge key={keyword} variant={keywordVariant(keyword)} size="md">
                {keyword} ({count})
              </Badge>
            ))}
        </div>
      </Card>

      {/* Project/Space Breakdown */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-700">Hits by Project / Space</h4>
        </div>
        <div className="space-y-2">
          {Object.entries(scansByProject)
            .sort(([, a], [, b]) => b - a)
            .map(([key, count]) => (
              <Card key={key} padding="sm" className="!p-3">
                <div className="flex items-center gap-3">
                  <code className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0 w-20 text-center">
                    {key}
                  </code>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${(count / maxProjectCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-mono font-semibold text-gray-700 w-10 text-right">
                    {count}
                  </span>
                </div>
              </Card>
            ))}
        </div>
      </div>

      {/* Hits Table */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-700">All Compliance Hits ({hits.length})</h4>
        </div>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Keyword
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Excerpt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hits.map((hit, i) => (
                  <HitRow key={`${hit.source}-${hit.projectOrSpace}-${hit.keyword}-${i}`} hit={hit} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Source badge */}
      <Card variant="highlighted" className="!p-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Badge variant={data.source === 'gateway' ? 'green' : 'blue'}>
            {data.source === 'gateway' ? 'Live Data' : 'Mock Data'}
          </Badge>
          <span>
            Compliance scan via{' '}
            <code className="font-mono text-purple-600">searchJiraIssuesUsingJql</code> and{' '}
            <code className="font-mono text-purple-600">searchConfluenceUsingCql</code>
          </span>
        </div>
      </Card>
    </div>
  );
}

function HitRow({ hit }: { hit: ComplianceHit }) {
  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-2.5">
        <Badge variant={hit.source === 'jira' ? 'blue' : 'purple'}>
          {hit.source === 'jira' ? (
            <span className="flex items-center gap-1">
              <Bug className="w-3 h-3" /> Jira
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> Confluence
            </span>
          )}
        </Badge>
      </td>
      <td className="px-4 py-2.5">
        <code className="text-xs font-mono text-gray-600">{hit.projectOrSpace}</code>
      </td>
      <td className="px-4 py-2.5">
        <p className="text-sm text-gray-900 line-clamp-1">{hit.title}</p>
        {hit.key && (
          <code className="text-[10px] font-mono text-gray-400">{hit.key}</code>
        )}
      </td>
      <td className="px-4 py-2.5">
        <Badge variant={keywordVariant(hit.keyword)}>{hit.keyword}</Badge>
      </td>
      <td className="px-4 py-2.5 hidden lg:table-cell">
        {hit.excerpt ? (
          <p className="text-xs text-gray-500 line-clamp-2 max-w-[250px]">{hit.excerpt}</p>
        ) : (
          <span className="text-xs text-gray-300 italic">--</span>
        )}
      </td>
    </tr>
  );
}
