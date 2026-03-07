import { Sparkles, Shield, TrendingUp, FileText, ExternalLink } from 'lucide-react';
import type { ArchitectureData, ArchitectureComponent, ConfluenceContextPage } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Accordion } from '../ui/Accordion';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';
import { MermaidDiagram } from '../MermaidDiagram';
import { ConfluenceSearchCallout } from '../SecurityCallout';

interface ArchitectureStepProps {
  data: ArchitectureData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function ArchitectureStep({ data, isGenerating, requestParams }: ArchitectureStepProps) {
  if (isGenerating && !data) return <StepSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline toolName="generate_architecture" parameters={requestParams} isGenerating={isGenerating} />

      {/* Referenced Confluence Docs */}
      {data.confluenceContext && data.confluenceContext.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-purple-500" />
            <h4 className="text-sm font-semibold text-gray-700">Referenced Confluence Docs</h4>
            <Badge variant="purple">via searchConfluenceUsingCql</Badge>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.confluenceContext.map((page, i) => (
              <Card key={i} className="!p-4 border-purple-100 hover:border-purple-200 transition-colors">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{page.title}</p>
                    {page.spaceKey && (
                      <span className="text-[10px] font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                        {page.spaceKey}
                      </span>
                    )}
                    <p className="text-xs text-gray-500 mt-1 line-clamp-3">{page.excerpt}</p>
                    {page.url && (
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 mt-1.5"
                      >
                        Open in Confluence <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <ConfluenceSearchCallout />
        </div>
      )}

      {/* Pattern Selection Card */}
      <Card variant="bordered">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-claude-orange" />
              <h3 className="text-lg font-semibold text-gray-900">{data.patternName}</h3>
            </div>
            <Badge variant="amber" size="md">Recommended Pattern</Badge>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed mt-3">{data.rationale}</p>
      </Card>

      {/* Mermaid Diagram */}
      {data.mermaidDiagram && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Architecture Diagram</h4>
          <MermaidDiagram chart={data.mermaidDiagram} />
        </div>
      )}

      {/* Component Grid */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Components</h4>
        <div className="grid md:grid-cols-2 gap-4">
          {data.components.map((comp) => (
            <ComponentCard key={comp.name} component={comp} />
          ))}
        </div>
      </div>

      {/* Data Flow */}
      {data.dataFlow.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Data Flow</h4>
          <Card>
            <ol className="space-y-2">
              {data.dataFlow.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-claude-orange/10 text-claude-orange flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="text-gray-700 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {/* Security + Scaling Accordions */}
      <div className="space-y-3">
        {data.securityConsiderations.length > 0 && (
          <Accordion title="Security Considerations" icon={<Shield className="w-4 h-4 text-red-500" />}>
            <ul className="space-y-1.5">
              {data.securityConsiderations.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#x2022;</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </Accordion>
        )}
        {data.scalingConsiderations.length > 0 && (
          <Accordion title="Scaling Considerations" icon={<TrendingUp className="w-4 h-4 text-blue-500" />}>
            <ul className="space-y-1.5">
              {data.scalingConsiderations.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">&#x2022;</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </Accordion>
        )}
      </div>

      {/* Alternatives */}
      {data.alternatives && data.alternatives.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Alternative Patterns</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.alternatives.map((alt) => (
              <Card key={alt.pattern} className="!p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">{alt.pattern.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-500">{alt.rationale}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComponentCard({ component }: { component: ArchitectureComponent }) {
  const cloudServices = Object.entries(component.services).filter(([k]) => k !== 'anthropic');
  const anthropicServices = component.services.anthropic || [];

  return (
    <Card className="!p-4">
      <h5 className="font-semibold text-gray-900 text-sm mb-1.5 capitalize">
        {component.name.replace(/_/g, ' ')}
      </h5>
      <p className="text-xs text-gray-600 mb-3">{component.description}</p>
      <div className="space-y-2">
        {cloudServices.map(([provider, services]) =>
          services.length > 0 ? (
            <div key={provider} className="flex flex-wrap gap-1">
              {services.map((s: string) => (
                <Badge key={s} variant="orange">{s}</Badge>
              ))}
            </div>
          ) : null
        )}
        {anthropicServices.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {anthropicServices.map((s: string) => (
              <Badge key={s} variant="amber">{s}</Badge>
            ))}
          </div>
        )}
      </div>
      {component.considerations.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500 font-medium mb-1">Considerations:</p>
          <ul className="text-xs text-gray-500 space-y-0.5">
            {component.considerations.map((c, i) => (
              <li key={i}>- {c}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
