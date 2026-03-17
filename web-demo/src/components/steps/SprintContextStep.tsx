'use client';

import { Layers, User, Hash, CheckCircle2 } from 'lucide-react';
import type { SprintContextData } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepSkeleton } from '../ui/Skeleton';
import { SecurityPipeline } from '../SecurityPipeline';

interface SprintContextStepProps {
  data: SprintContextData | null;
  isGenerating: boolean;
  requestParams: Record<string, unknown>;
}

export function SprintContextStep({ data, isGenerating, requestParams }: SprintContextStepProps) {
  if (isGenerating && !data) {
    return (
      <div className="space-y-5 animate-fade-in">
        <SecurityPipeline
          toolName="sprint_context"
          parameters={requestParams}
          isGenerating={isGenerating}
        />
        <StepSkeleton />
      </div>
    );
  }

  if (!data) return null;

  const { selectedProject } = data;

  return (
    <div className="space-y-5 animate-fade-in">
      <SecurityPipeline
        toolName="sprint_context"
        parameters={requestParams}
        isGenerating={isGenerating}
      />

      {/* Selected Project Card */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <code className="text-sm font-mono font-semibold text-claude-orange">
                {selectedProject.key}
              </code>
              <h3 className="text-lg font-semibold text-gray-900">{selectedProject.name}</h3>
            </div>
            {selectedProject.lead && (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-gray-400" />
                Lead: {selectedProject.lead}
              </p>
            )}
          </div>
          <Badge variant="green" size="md">
            {data.source === 'gateway' ? 'Live Data' : 'Mock'}
          </Badge>
        </div>
        {selectedProject.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{selectedProject.description}</p>
        )}
      </Card>

      {/* Issue Types Grid */}
      {selectedProject.issueTypes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            Issue Types
          </h4>
          <div className="grid sm:grid-cols-2 gap-2">
            {selectedProject.issueTypes.map((issueType) => (
              <Card key={issueType.id} padding="sm" className="!p-3">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Hash className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{issueType.name}</p>
                    {issueType.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                        {issueType.description}
                      </p>
                    )}
                    <code className="text-[10px] font-mono text-gray-400">id: {issueType.id}</code>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Field Schema Table */}
      {selectedProject.fieldSchemas.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Field Schemas</h4>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Field ID
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Required
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {selectedProject.fieldSchemas.map((field) => (
                    <tr key={field.fieldId} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2">
                        <code className="text-xs font-mono text-blue-600">{field.fieldId}</code>
                      </td>
                      <td className="px-4 py-2 text-gray-900">{field.name}</td>
                      <td className="px-4 py-2">
                        <Badge variant="purple">{field.type}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        {field.required ? (
                          <Badge variant="red">Required</Badge>
                        ) : (
                          <Badge variant="gray">Optional</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Summary Bar */}
      <Card variant="highlighted" className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm font-semibold text-gray-900">Project Context Loaded</span>
        </div>
        <div className="h-4 w-px bg-gray-300" />
        <span className="text-xs text-gray-600">
          {selectedProject.issueTypes.length} issue type{selectedProject.issueTypes.length !== 1 ? 's' : ''}
        </span>
        <div className="h-4 w-px bg-gray-300" />
        <span className="text-xs text-gray-600">
          {selectedProject.fieldSchemas.length} field{selectedProject.fieldSchemas.length !== 1 ? 's' : ''} available
        </span>
        {data.projects.length > 1 && (
          <>
            <div className="h-4 w-px bg-gray-300" />
            <span className="text-xs text-gray-600">
              {data.projects.length} project{data.projects.length !== 1 ? 's' : ''} discovered
            </span>
          </>
        )}
      </Card>
    </div>
  );
}
