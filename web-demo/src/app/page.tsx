'use client';

import { useState, useCallback, useEffect } from 'react';
import { Play, ChevronRight, RotateCcw } from 'lucide-react';
import type {
  Step,
  Industry,
  DemoState,
  ProjectContextData,
  ArchitectureData,
  ComplianceData,
  PlanData,
} from '@/types/api';
import { SCENARIOS } from '@/lib/constants';
import { Header } from '@/components/Header';
import { StepProgress } from '@/components/StepProgress';
import { HeroLanding } from '@/components/HeroLanding';
import { ContextStep } from '@/components/steps/ContextStep';
import { ArchitectureStep } from '@/components/steps/ArchitectureStep';
import { ComplianceStep } from '@/components/steps/ComplianceStep';
import { PlanStep } from '@/components/steps/PlanStep';
import { CompleteStep } from '@/components/steps/CompleteStep';

const STEP_ORDER: Step[] = ['select', 'context', 'architecture', 'compliance', 'plan', 'complete'];

export default function Home() {
  const [state, setState] = useState<DemoState>({
    selectedIndustry: null,
    currentStep: 'select',
    isGenerating: false,
    error: null,
    data: { context: null, architecture: null, compliance: null, plan: null },
  });

  const { selectedIndustry, currentStep, isGenerating, error, data } = state;

  const projectKey = selectedIndustry
    ? SCENARIOS.find((s) => s.industry === selectedIndustry)!.projectKey
    : '';

  const completedSteps = new Set(
    (['context', 'architecture', 'compliance', 'plan'] as const).filter(
      (s) => data[s] !== null
    )
  );

  // Auto-fetch context preview on industry selection
  useEffect(() => {
    if (!selectedIndustry) return;
    const key = SCENARIOS.find((s) => s.industry === selectedIndustry)!.projectKey;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tools/read-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectKey: key, includeIssues: true, issueLimit: 10 }),
        });
        if (!res.ok) return;
        const ctxData: ProjectContextData = await res.json();
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            data: { ...prev.data, context: prev.data.context ?? ctxData },
          }));
        }
      } catch {
        // Silent — will load when user clicks Generate
      }
    })();
    return () => { cancelled = true; };
  }, [selectedIndustry]);

  // Build request params for each step (used by ToolNarrative)
  const getRequestParams = useCallback(
    (step: Step, ctxOverride?: ProjectContextData, archOverride?: ArchitectureData) => {
      const ctx = ctxOverride ?? data.context;
      const arch = archOverride ?? data.architecture;
      const industry = selectedIndustry === 'healthcare' ? 'healthcare' : 'financial_services';
      const complianceTags = ctx?.allLabels.filter((l) =>
        ['hipaa', 'soc2', 'fedramp', 'pci_dss', 'gdpr', 'ccpa'].includes(l)
      ) || [];

      if (step === 'context') {
        return { projectKey, includeIssues: true, issueLimit: 10 };
      }
      const projectContext = {
        projectKey,
        industry,
        useCaseDescription: ctx?.project.description || 'AI-powered enterprise application',
        complianceTags,
        cloudProvider: 'aws',
        dataTypes: ctx?.detectedDataTypes || [],
        integrationTargets: ctx?.detectedIntegrations || [],
      };
      if (step === 'architecture') {
        return { projectContext, includeDiagram: true, includeAlternatives: true };
      }
      if (step === 'compliance') {
        return { projectContext, detailLevel: 'detailed', includeChecklist: true };
      }
      if (step === 'plan') {
        return {
          projectContext,
          architecturePattern: arch?.pattern || 'conversational_agent',
          teamSize: 5,
          sprintLengthWeeks: 2,
          includeJiraTickets: true,
        };
      }
      return {};
    },
    [selectedIndustry, projectKey, data.context, data.architecture]
  );

  // Core API caller — returns typed data for chaining
  const generateStep = useCallback(
    async (
      step: Step,
      ctxOverride?: ProjectContextData,
      archOverride?: ArchitectureData
    ): Promise<{ context?: ProjectContextData; architecture?: ArchitectureData }> => {
      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      const ctx = ctxOverride ?? data.context;
      const arch = archOverride ?? data.architecture;
      const result: { context?: ProjectContextData; architecture?: ArchitectureData } = {};

      try {
        const industry = selectedIndustry === 'healthcare' ? 'healthcare' : 'financial_services';
        const complianceTags = ctx?.allLabels.filter((l) =>
          ['hipaa', 'soc2', 'fedramp', 'pci_dss', 'gdpr', 'ccpa'].includes(l)
        ) || [];

        if (step === 'context') {
          const res = await fetch('/api/tools/read-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectKey, includeIssues: true, issueLimit: 10 }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const ctxData: ProjectContextData = await res.json();
          result.context = ctxData;
          setState((prev) => ({
            ...prev,
            data: { ...prev.data, context: ctxData },
          }));
        } else if (step === 'architecture') {
          const res = await fetch('/api/tools/generate-architecture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectContext: {
                projectKey,
                industry,
                useCaseDescription: ctx?.project.description || 'AI-powered enterprise application',
                complianceTags,
                cloudProvider: 'aws',
                dataTypes: ctx?.detectedDataTypes || [],
                integrationTargets: ctx?.detectedIntegrations || [],
              },
              includeDiagram: true,
              includeAlternatives: true,
            }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const archData: ArchitectureData = await res.json();
          result.architecture = archData;
          setState((prev) => ({
            ...prev,
            data: { ...prev.data, architecture: archData },
          }));
        } else if (step === 'compliance') {
          const res = await fetch('/api/tools/assess-compliance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectContext: {
                projectKey,
                industry,
                useCaseDescription: ctx?.project.description || 'AI-powered enterprise application',
                complianceTags,
                cloudProvider: 'aws',
                dataTypes: ctx?.detectedDataTypes || [],
                integrationTargets: ctx?.detectedIntegrations || [],
              },
              detailLevel: 'detailed',
              includeChecklist: true,
            }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const compData: ComplianceData = await res.json();
          setState((prev) => ({
            ...prev,
            data: { ...prev.data, compliance: compData },
          }));
        } else if (step === 'plan') {
          const res = await fetch('/api/tools/create-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectContext: {
                projectKey,
                industry,
                useCaseDescription: ctx?.project.description || 'AI-powered enterprise application',
                complianceTags,
                cloudProvider: 'aws',
                dataTypes: ctx?.detectedDataTypes || [],
                integrationTargets: ctx?.detectedIntegrations || [],
              },
              architecturePattern: arch?.pattern || 'conversational_agent',
              teamSize: 5,
              sprintLengthWeeks: 2,
              includeJiraTickets: true,
            }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const planData: PlanData = await res.json();
          setState((prev) => ({
            ...prev,
            data: { ...prev.data, plan: planData },
          }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setState((prev) => ({ ...prev, error: msg }));
      } finally {
        setState((prev) => ({ ...prev, isGenerating: false }));
      }

      return result;
    },
    [projectKey, selectedIndustry, data.context, data.architecture]
  );

  const handleSelectIndustry = (industry: Industry) => {
    setState({
      selectedIndustry: industry,
      currentStep: 'context',
      isGenerating: false,
      error: null,
      data: { context: null, architecture: null, compliance: null, plan: null },
    });
  };

  const handleStartOver = () => {
    setState({
      selectedIndustry: null,
      currentStep: 'select',
      isGenerating: false,
      error: null,
      data: { context: null, architecture: null, compliance: null, plan: null },
    });
  };

  const handleNextStep = async () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    const next = STEP_ORDER[idx + 1];
    if (!next) return;

    if (next === 'complete') {
      setState((prev) => ({ ...prev, currentStep: 'complete' }));
    } else {
      setState((prev) => ({ ...prev, currentStep: next }));
      await generateStep(next);
    }
  };

  const handleRunAll = async () => {
    const steps: Step[] = ['context', 'architecture', 'compliance', 'plan'];
    let ctx: ProjectContextData | undefined;
    let arch: ArchitectureData | undefined;

    for (const step of steps) {
      setState((prev) => ({ ...prev, currentStep: step }));
      const result = await generateStep(step, ctx, arch);
      if (result.context) ctx = result.context;
      if (result.architecture) arch = result.architecture;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    setState((prev) => ({ ...prev, currentStep: 'complete' }));
  };

  return (
    <main className="min-h-screen">
      <Header />

      {selectedIndustry && currentStep !== 'select' && (
        <StepProgress currentStep={currentStep} completedSteps={completedSteps} />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            Error: {error}
          </div>
        )}

        {/* Landing */}
        {currentStep === 'select' && (
          <HeroLanding onSelectIndustry={handleSelectIndustry} />
        )}

        {/* Context - pre-generation preview */}
        {currentStep === 'context' && !completedSteps.has('context') && !isGenerating && (
          <div className="space-y-5 animate-fade-in">
            {/* Show issue preview cards if auto-fetched */}
            {data.context && data.context.issues.length > 0 && (
              <ContextStep
                data={data.context}
                isGenerating={false}
                projectKey={projectKey}
                industry={selectedIndustry || 'healthcare'}
                requestParams={getRequestParams('context')}
              />
            )}
            {/* Action buttons */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4">
              <button
                onClick={handleStartOver}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                &larr; Back to scenarios
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleRunAll}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-claude-orange text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  <Play className="w-4 h-4" />
                  Run Full Demo
                </button>
                <button
                  onClick={() => { setState((prev) => ({ ...prev, currentStep: 'context' })); generateStep('context'); }}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-anthropic-900 text-white rounded-lg hover:bg-anthropic-800 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  Generate Context
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Context - generated */}
        {currentStep === 'context' && (completedSteps.has('context') || isGenerating) && (
          <ContextStep
            data={data.context}
            isGenerating={isGenerating}
            projectKey={projectKey}
            industry={selectedIndustry || 'healthcare'}
            requestParams={getRequestParams('context')}
          />
        )}

        {/* Architecture */}
        {currentStep === 'architecture' && (
          <ArchitectureStep
            data={data.architecture}
            isGenerating={isGenerating}
            requestParams={getRequestParams('architecture')}
          />
        )}

        {/* Compliance */}
        {currentStep === 'compliance' && (
          <ComplianceStep
            data={data.compliance}
            isGenerating={isGenerating}
            requestParams={getRequestParams('compliance')}
          />
        )}

        {/* Plan */}
        {currentStep === 'plan' && (
          <PlanStep
            data={data.plan}
            isGenerating={isGenerating}
            requestParams={getRequestParams('plan')}
          />
        )}

        {/* Complete */}
        {currentStep === 'complete' && (
          <CompleteStep data={data} onStartOver={handleStartOver} />
        )}

        {/* Step Navigation */}
        {selectedIndustry &&
          currentStep !== 'select' &&
          currentStep !== 'complete' &&
          !isGenerating &&
          completedSteps.has(currentStep) && (
            <div className="flex items-center justify-between mt-6 bg-white rounded-xl border border-gray-200 px-5 py-4">
              <button
                onClick={handleStartOver}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>
              <button
                onClick={handleNextStep}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentStep === 'plan'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-anthropic-900 text-white hover:bg-anthropic-800'
                }`}
              >
                {currentStep === 'plan' ? 'Complete Demo' : 'Next Step'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
      </div>
    </main>
  );
}
