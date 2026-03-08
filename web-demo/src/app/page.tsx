'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import type {
  Step,
  Industry,
  DemoState,
  ProjectContextData,
  ArchitectureData,
  SearchData,
  HealthData,
  ComplianceData,
  PlanData,
  AgentActionsData,
} from '@/types/api';
import { SCENARIOS } from '@/lib/constants';
import { Header } from '@/components/Header';
import { StepProgress } from '@/components/StepProgress';
import { ToolCallStats } from '@/components/ToolCallStats';
import { HeroLanding } from '@/components/HeroLanding';
import { ContextStep } from '@/components/steps/ContextStep';
import { SearchStep } from '@/components/steps/SearchStep';
import { HealthStep } from '@/components/steps/HealthStep';
import { ArchitectureStep } from '@/components/steps/ArchitectureStep';
import { ComplianceStep } from '@/components/steps/ComplianceStep';
import { PlanStep } from '@/components/steps/PlanStep';
import { ActionsStep } from '@/components/steps/ActionsStep';
import { CompleteStep } from '@/components/steps/CompleteStep';

const STEP_ORDER: Step[] = ['select', 'context', 'search', 'health', 'architecture', 'compliance', 'plan', 'actions', 'complete'];

export default function Home() {
  const [state, setState] = useState<DemoState>({
    selectedIndustry: null,
    currentStep: 'select',
    isGenerating: false,
    error: null,
    data: { context: null, search: null, health: null, architecture: null, compliance: null, plan: null, actions: null },
  });

  const { selectedIndustry, currentStep, isGenerating, error, data } = state;

  // Ref mirrors selectedIndustry so async callbacks always read the latest value
  const industryRef = useRef(selectedIndustry);
  industryRef.current = selectedIndustry;

  const projectKey = selectedIndustry
    ? SCENARIOS.find((s) => s.industry === selectedIndustry)!.projectKey
    : '';
  const projectKeyRef = useRef(projectKey);
  projectKeyRef.current = projectKey;

  const completedSteps = new Set(
    (['context', 'search', 'health', 'architecture', 'compliance', 'plan', 'actions'] as const).filter(
      (s) => data[s] !== null
    )
  );

  // Tool call stats — computed from completed steps
  const toolCallStats = useMemo(() => {
    let totalCalls = 0;
    let blocked = 0;

    if (data.context) totalCalls += 3; // getResources + getProjects + searchJql
    if (data.search) totalCalls += 2; // rovo search + jql fallback
    if (data.health) totalCalls += 4; // 4 parallel JQL
    if (data.architecture) {
      totalCalls += 1; // knowledge base
      if (data.architecture.confluenceContext?.length) totalCalls += 2; // CQL + getPage
    }
    if (data.compliance) {
      totalCalls += 1; // knowledge base
      if (data.compliance.documentCoverage?.length) totalCalls += data.compliance.documentCoverage.length; // CQL per framework
    }
    if (data.plan) totalCalls += 1;
    if (data.actions) {
      totalCalls += data.actions.actions.length;
      blocked += data.actions.actions.filter((a) => a.policyBlocked).length;
    }

    return { totalCalls, blocked, piiScans: totalCalls, threats: 0 };
  }, [data]);

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

  // Build request params for each step (used by SecurityPipeline)
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
      if (step === 'search') {
        return { projectKey, query: `${projectKey} architecture compliance deployment` };
      }
      if (step === 'health') {
        return { projectKey };
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
      if (step === 'actions') {
        return {
          projectKey,
          enabledActions: ['label_issues', 'add_comment', 'transition_issue', 'create_confluence', 'create_jira'],
        };
      }
      return {};
    },
    [selectedIndustry, projectKey, data.context, data.architecture]
  );

  // Core API caller — returns typed data for chaining.
  // Uses refs for selectedIndustry/projectKey to avoid stale closure issues.
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
      const pk = projectKeyRef.current;

      try {
        const industry = industryRef.current === 'healthcare' ? 'healthcare' : 'financial_services';
        const complianceTags = ctx?.allLabels.filter((l) =>
          ['hipaa', 'soc2', 'fedramp', 'pci_dss', 'gdpr', 'ccpa'].includes(l)
        ) || [];

        if (step === 'context') {
          const res = await fetch('/api/tools/read-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectKey: pk, includeIssues: true, issueLimit: 10 }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const ctxData: ProjectContextData = await res.json();
          result.context = ctxData;
          setState((prev) => ({
            ...prev,
            data: { ...prev.data, context: ctxData },
          }));
        } else if (step === 'search') {
          const res = await fetch('/api/tools/cross-product-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectKey: pk,
              query: `${pk} architecture compliance deployment`,
            }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const searchData: SearchData = await res.json();
          setState((prev) => ({
            ...prev,
            data: { ...prev.data, search: searchData },
          }));
        } else if (step === 'health') {
          const res = await fetch('/api/tools/project-health', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectKey: pk }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const healthData: HealthData = await res.json();
          setState((prev) => ({
            ...prev,
            data: { ...prev.data, health: healthData },
          }));
        } else if (step === 'architecture') {
          const res = await fetch('/api/tools/generate-architecture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectContext: {
                projectKey: pk,
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
                projectKey: pk,
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
                projectKey: pk,
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
        // Note: 'actions' step is handled separately via handleExecuteActions
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setState((prev) => ({ ...prev, error: msg }));
      } finally {
        setState((prev) => ({ ...prev, isGenerating: false }));
      }

      return result;
    },
    [data.context, data.architecture]
  );

  const handleSelectIndustry = async (industry: Industry) => {
    setState({
      selectedIndustry: industry,
      currentStep: 'context',
      isGenerating: false,
      error: null,
      data: { context: null, search: null, health: null, architecture: null, compliance: null, plan: null, actions: null },
    });
    // Auto-start context generation
    await generateStep('context');
  };

  const handleStartOver = () => {
    setState({
      selectedIndustry: null,
      currentStep: 'select',
      isGenerating: false,
      error: null,
      data: { context: null, search: null, health: null, architecture: null, compliance: null, plan: null, actions: null },
    });
  };

  const handleNextStep = async () => {
    const idx = STEP_ORDER.indexOf(currentStep);
    const next = STEP_ORDER[idx + 1];
    if (!next) return;

    if (next === 'complete') {
      setState((prev) => ({ ...prev, currentStep: 'complete' }));
    } else if (next === 'actions') {
      // Actions step doesn't auto-generate — user picks actions first
      setState((prev) => ({ ...prev, currentStep: 'actions' }));
    } else {
      setState((prev) => ({ ...prev, currentStep: next }));
      await generateStep(next);
    }
  };

  // Agent Actions handler
  const handleExecuteActions = useCallback(async (enabledActions: string[]) => {
    setState((prev) => ({ ...prev, isGenerating: true, error: null }));
    try {
      // Build architecture content for Confluence creation
      const architectureTitle = data.architecture
        ? `${data.context?.project.name ?? projectKey} - Architecture: ${data.architecture.patternName}`
        : undefined;
      const architectureContent = data.architecture
        ? [
            `# ${architectureTitle}`,
            '',
            `## Pattern: ${data.architecture.patternName}`,
            '',
            data.architecture.rationale,
            '',
            '## Components',
            ...data.architecture.components.map((c) => `- **${c.name}**: ${c.description}`),
            '',
            '## Security Considerations',
            ...data.architecture.securityConsiderations.map((s) => `- ${s}`),
          ].join('\n')
        : undefined;

      const issueKey = data.context?.issues?.[0]?.key;
      const jiraTickets = data.plan?.jiraTickets?.slice(0, 3).map((t) => ({
        summary: t.summary,
        description: t.description,
        type: t.type,
      }));

      const res = await fetch('/api/tools/agent-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectKey,
          enabledActions,
          issueKey,
          architectureTitle,
          architectureContent,
          jiraTickets,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const actionsData: AgentActionsData = await res.json();
      setState((prev) => ({
        ...prev,
        data: { ...prev.data, actions: actionsData },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: msg }));
    } finally {
      setState((prev) => ({ ...prev, isGenerating: false }));
    }
  }, [projectKey, data.architecture, data.context, data.plan]);

  // For the actions step, show the next button after actions data exists OR when it's the current step without data (pre-execute state)
  const showNavigation =
    selectedIndustry &&
    currentStep !== 'select' &&
    currentStep !== 'complete' &&
    !isGenerating &&
    (currentStep === 'actions' ? data.actions !== null : completedSteps.has(currentStep));

  return (
    <main className="min-h-screen">
      <Header isRunning={isGenerating} />

      {selectedIndustry && currentStep !== 'select' && (
        <>
          <StepProgress currentStep={currentStep} completedSteps={completedSteps} />
          <ToolCallStats {...toolCallStats} />
        </>
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

        {/* Context */}
        {currentStep === 'context' && (
          <ContextStep
            data={data.context}
            isGenerating={isGenerating}
            projectKey={projectKey}
            industry={selectedIndustry || 'healthcare'}
            requestParams={getRequestParams('context')}
          />
        )}

        {/* Search */}
        {currentStep === 'search' && (
          <SearchStep
            results={data.search?.results ?? null}
            isGenerating={isGenerating}
            requestParams={getRequestParams('search')}
          />
        )}

        {/* Health */}
        {currentStep === 'health' && (
          <HealthStep
            data={data.health}
            isGenerating={isGenerating}
            requestParams={getRequestParams('health')}
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

        {/* Agent Actions */}
        {currentStep === 'actions' && (
          <ActionsStep
            data={data.actions}
            isGenerating={isGenerating}
            requestParams={getRequestParams('actions')}
            onExecuteActions={handleExecuteActions}
          />
        )}

        {/* Complete */}
        {currentStep === 'complete' && (
          <CompleteStep data={data} onStartOver={handleStartOver} />
        )}

        {/* Step Navigation */}
        {showNavigation && (
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
                currentStep === 'actions'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-anthropic-900 text-white hover:bg-anthropic-800'
              }`}
            >
              {currentStep === 'actions' ? 'Complete Demo' : 'Next Step'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
