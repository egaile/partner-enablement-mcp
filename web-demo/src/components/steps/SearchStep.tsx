import { Search, FileText, Bug } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { ToolNarrative } from '../ToolNarrative';

export interface SearchResult {
  type: 'jira' | 'confluence';
  key?: string;
  title: string;
  excerpt: string;
  url?: string;
  issueType?: string;
  status?: string;
  spaceKey?: string;
}

interface SearchStepProps {
  results: SearchResult[] | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function SearchStep({ results, isGenerating, requestParams }: SearchStepProps) {
  if (isGenerating && !results) return <StepSkeleton />;
  if (!results) return null;

  const jiraResults = results.filter((r) => r.type === 'jira');
  const confluenceResults = results.filter((r) => r.type === 'confluence');

  return (
    <div className="space-y-5 animate-fade-in">
      <ToolNarrative toolName="cross_product_search" parameters={requestParams} />

      <div className="flex items-center gap-2 mb-2">
        <Search className="w-4 h-4 text-claude-orange" />
        <h3 className="text-sm font-semibold text-gray-700">
          {results.length} results across Jira &amp; Confluence
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Jira Results */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Bug className="w-3.5 h-3.5" />
            Jira Issues ({jiraResults.length})
          </h4>
          <div className="space-y-2">
            {jiraResults.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No matching Jira issues</p>
            ) : (
              jiraResults.map((r, i) => (
                <Card key={i} padding="sm" className="!p-3">
                  <div className="flex items-start gap-2">
                    <code className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                      {r.key}
                    </code>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-tight">{r.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.excerpt}</p>
                      <div className="flex gap-1.5 mt-1.5">
                        {r.issueType && <Badge variant="blue">{r.issueType}</Badge>}
                        {r.status && <Badge variant="gray">{r.status}</Badge>}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Confluence Results */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Confluence Pages ({confluenceResults.length})
          </h4>
          <div className="space-y-2">
            {confluenceResults.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No matching Confluence pages</p>
            ) : (
              confluenceResults.map((r, i) => (
                <Card key={i} padding="sm" className="!p-3">
                  <div className="flex items-start gap-2">
                    {r.spaceKey && (
                      <span className="text-xs font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded shrink-0">
                        {r.spaceKey}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-tight">{r.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.excerpt}</p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
