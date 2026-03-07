import { AlertTriangle, CheckSquare, ShieldAlert, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ComplianceData, ComplianceRequirement, RiskArea, ChecklistItem, ComplianceDocCoverage } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Accordion } from '../ui/Accordion';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';
import { ConfluenceSearchCallout } from '../SecurityCallout';

interface ComplianceStepProps {
  data: ComplianceData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function ComplianceStep({ data, isGenerating, requestParams }: ComplianceStepProps) {
  if (isGenerating && !data) return <StepSkeleton />;
  if (!data) return null;

  // Group requirements by category
  const requirementsByCategory = data.keyRequirements.reduce(
    (acc, req) => {
      (acc[req.category] = acc[req.category] || []).push(req);
      return acc;
    },
    {} as Record<string, ComplianceRequirement[]>
  );

  // Group checklist by category
  const checklistByCategory = (data.checklist || []).reduce(
    (acc, item) => {
      (acc[item.category] = acc[item.category] || []).push(item);
      return acc;
    },
    {} as Record<string, ChecklistItem[]>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline toolName="assess_compliance" parameters={requestParams} isGenerating={isGenerating} />

      {/* Documentation Coverage */}
      {data.documentCoverage && data.documentCoverage.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-purple-500" />
            <h4 className="text-sm font-semibold text-gray-700">Documentation Coverage</h4>
            <Badge variant="purple">via searchConfluenceUsingCql</Badge>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.documentCoverage.map((cov) => (
              <Card key={cov.framework} className="!p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-sm font-semibold text-gray-900 uppercase">{cov.framework}</h5>
                  <CoverageBadge coverage={cov.coverage} />
                </div>
                {cov.existingDocs.length > 0 ? (
                  <ul className="space-y-1">
                    {cov.existingDocs.map((doc, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{doc.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400 italic">No documentation found</p>
                )}
              </Card>
            ))}
          </div>
          <ConfluenceSearchCallout />
        </div>
      )}

      {/* Framework Priority Cards */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Applicable Frameworks</h4>
        <div className="flex flex-wrap gap-3">
          {data.applicableFrameworks.map((fw) => (
            <Card key={fw.framework} className="!p-4 flex-1 min-w-[200px]">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-semibold text-gray-900 text-sm">{fw.name}</h5>
                <Badge
                  variant={fw.priority === 'required' ? 'red' : 'amber'}
                  size="sm"
                >
                  {fw.priority === 'required' ? 'Required' : 'Recommended'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">{fw.applicabilityReason}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Key Requirements */}
      {Object.keys(requirementsByCategory).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Key Requirements</h4>
          <div className="space-y-3">
            {Object.entries(requirementsByCategory).map(([category, reqs]) => (
              <Accordion key={category} title={`${category} (${reqs.length})`} defaultOpen={reqs.some(r => r.priority === 'critical')}>
                <div className="space-y-3">
                  {reqs.map((req, i) => (
                    <RequirementRow key={i} requirement={req} />
                  ))}
                </div>
              </Accordion>
            ))}
          </div>
        </div>
      )}

      {/* Risk Areas */}
      {data.riskAreas.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Risk Areas</h4>
          <div className="space-y-3">
            {data.riskAreas.map((risk, i) => (
              <RiskCard key={i} risk={risk} />
            ))}
          </div>
        </div>
      )}

      {/* Implementation Checklist */}
      {Object.keys(checklistByCategory).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Implementation Checklist</h4>
          <Card>
            <div className="space-y-4">
              {Object.entries(checklistByCategory).map(([category, items]) => (
                <div key={category}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{category}</p>
                  <div className="space-y-1.5">
                    {items.map((item, i) => (
                      <label key={i} className="flex items-start gap-2 text-sm text-gray-700 cursor-default">
                        <CheckSquare className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                        <span>{item.item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function RequirementRow({ requirement }: { requirement: ComplianceRequirement }) {
  const priorityVariant =
    requirement.priority === 'critical' ? 'red' : requirement.priority === 'high' ? 'orange' : 'amber';

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-gray-900">{requirement.requirement}</p>
        <Badge variant={priorityVariant}>{requirement.priority}</Badge>
      </div>
      <p className="text-xs text-gray-500">{requirement.implementation}</p>
    </div>
  );
}

function CoverageBadge({ coverage }: { coverage: 'full' | 'partial' | 'missing' }) {
  if (coverage === 'full') return <Badge variant="green">Full</Badge>;
  if (coverage === 'partial') return <Badge variant="amber">Partial</Badge>;
  return <Badge variant="red">Missing</Badge>;
}

function RiskCard({ risk }: { risk: RiskArea }) {
  return (
    <Card className="!p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h5 className="font-semibold text-gray-900 text-sm mb-1">{risk.area}</h5>
          <p className="text-xs text-gray-600 mb-2">{risk.risk}</p>
          <div className="bg-green-50 rounded-md px-3 py-2">
            <p className="text-xs text-green-800">
              <span className="font-medium">Mitigation:</span> {risk.mitigation}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
