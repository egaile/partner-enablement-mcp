'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';
import type {
  Step,
  Industry,
  WorkflowId,
  FeatureId,
  DemoState,
  DemoData,
  ProjectContextData,
  ArchitectureData,
  SearchData,
  HealthData,
  ComplianceData,
  PlanData,
  AgentActionsData,
  SpaceDiscoveryData,
  PageTreeData,
  CommentAuditData,
  HealthScoringData,
  KnowledgeActionsData,
  SprintContextData,
  IssueDeepDiveData,
  TeamLookupData,
  SprintActionsData,
  PortfolioDiscoveryData,
  ComplianceScanData,
  RiskScoringData,
} from '@/types/api';
import { SCENARIOS, getWorkflowConfig, getStepDefinitions } from '@/lib/constants';
import { Header } from '@/components/Header';
import { StepProgress } from '@/components/StepProgress';
import { ToolCallStats } from '@/components/ToolCallStats';
import { HeroLanding } from '@/components/HeroLanding';
// Deployment Planning steps
import { ContextStep } from '@/components/steps/ContextStep';
import { SearchStep } from '@/components/steps/SearchStep';
import { HealthStep } from '@/components/steps/HealthStep';
import { ArchitectureStep } from '@/components/steps/ArchitectureStep';
import { ComplianceStep } from '@/components/steps/ComplianceStep';
import { PlanStep } from '@/components/steps/PlanStep';
import { ActionsStep } from '@/components/steps/ActionsStep';
// Knowledge Audit steps
import { SpaceDiscoveryStep } from '@/components/steps/SpaceDiscoveryStep';
import { PageTreeStep } from '@/components/steps/PageTreeStep';
import { CommentAuditStep } from '@/components/steps/CommentAuditStep';
import { HealthScoringStep } from '@/components/steps/HealthScoringStep';
import { KnowledgeActionsStep } from '@/components/steps/KnowledgeActionsStep';
// Sprint Operations steps
import { SprintContextStep } from '@/components/steps/SprintContextStep';
import { IssueDeepDiveStep } from '@/components/steps/IssueDeepDiveStep';
import { TeamLookupStep } from '@/components/steps/TeamLookupStep';
import { SprintActionsStep } from '@/components/steps/SprintActionsStep';
// Risk Radar steps
import { PortfolioDiscoveryStep } from '@/components/steps/PortfolioDiscoveryStep';
import { ComplianceScanStep } from '@/components/steps/ComplianceScanStep';
import { RiskHeatmapStep } from '@/components/steps/RiskHeatmapStep';
import { PolicyRecommendationStep } from '@/components/steps/PolicyRecommendationStep';
// Security & Governance features
import { SecuritySimulator } from '@/components/SecuritySimulator';
import { GovernanceControlRoom } from '@/components/GovernanceControlRoom';
// Complete
import { CompleteStep } from '@/components/steps/CompleteStep';

const EMPTY_DATA: DemoData = {
  context: null, search: null, health: null, architecture: null, compliance: null, plan: null, actions: null,
  'space-discovery': null, 'page-tree': null, 'comment-audit': null, 'health-scoring': null, 'knowledge-actions': null,
  'sprint-context': null, 'issue-deep-dive': null, 'team-lookup': null, 'sprint-actions': null,
  'portfolio-discovery': null, 'compliance-scan': null, 'risk-heatmap': null, 'policy-recommendations': null,
};

/** Steps that don't auto-generate — user picks actions first */
const ACTION_STEPS = new Set<string>(['actions', 'knowledge-actions', 'sprint-actions']);

export default function Home() {
  const [state, setState] = useState<DemoState>({
    selectedWorkflow: null,
    selectedIndustry: null,
    currentStep: 'select',
    isGenerating: false,
    error: null,
    data: { ...EMPTY_DATA },
  });

  // Feature state (for non-step-based interactive views)
  const [selectedFeature, setSelectedFeature] = useState<FeatureId | null>(null);

  const { selectedWorkflow, selectedIndustry, currentStep, isGenerating, error, data } = state;

  // Refs for async callbacks
  const industryRef = useRef(selectedIndustry);
  industryRef.current = selectedIndustry;
  const workflowRef = useRef(selectedWorkflow);
  workflowRef.current = selectedWorkflow;

  // Derive workflow config
  const workflowConfig = selectedWorkflow ? getWorkflowConfig(selectedWorkflow) : null;
  const stepOrder = workflowConfig?.stepOrder ?? (['select'] as Step[]);
  const stepDefinitions = selectedWorkflow ? getStepDefinitions(selectedWorkflow) : [];

  // Derive scenario config
  const scenario = selectedIndustry
    ? SCENARIOS.find((s) => s.industry === selectedIndustry)!
    : null;
  const projectKey = scenario?.projectKey ?? '';
  const spaceId = scenario?.spaceId ?? '';
  const projectKeyRef = useRef(projectKey);
  projectKeyRef.current = projectKey;
  const spaceIdRef = useRef(spaceId);
  spaceIdRef.current = spaceId;
  const dataRef = useRef(data);
  dataRef.current = data;

  // Completed steps for all workflow data keys
  const completedSteps = useMemo(() => {
    const steps = stepDefinitions.map((s) => s.key);
    return new Set<string>(steps.filter((s) => data[s] !== null));
  }, [stepDefinitions, data]);

  // Tool call stats — computed from completed steps
  const toolCallStats = useMemo(() => {
    let totalCalls = 0;
    let blocked = 0;

    // Deployment planning
    if (data.context) totalCalls += 3;
    if (data.search) totalCalls += 2;
    if (data.health) totalCalls += 4;
    if (data.architecture) {
      totalCalls += 1;
      if (data.architecture.confluenceContext?.length) totalCalls += 2;
    }
    if (data.compliance) {
      totalCalls += 1;
      if (data.compliance.documentCoverage?.length) totalCalls += data.compliance.documentCoverage.length;
    }
    if (data.plan) totalCalls += 1;
    if (data.actions) {
      totalCalls += data.actions.actions.length;
      blocked += data.actions.actions.filter((a) => a.policyBlocked).length;
    }

    // Knowledge audit
    if (data['space-discovery']) totalCalls += 2;
    if (data['page-tree']) totalCalls += 1 + (data['page-tree'].totalPages);
    if (data['comment-audit']) totalCalls += 3;
    if (data['health-scoring']) totalCalls += 0;
    if (data['knowledge-actions']) {
      totalCalls += data['knowledge-actions'].actions.length;
      blocked += data['knowledge-actions'].actions.filter((a) => a.policyBlocked).length;
    }

    // Sprint operations
    if (data['sprint-context']) totalCalls += 3;
    if (data['issue-deep-dive']) totalCalls += 4;
    if (data['team-lookup']) totalCalls += 1;
    if (data['sprint-actions']) {
      totalCalls += data['sprint-actions'].actions.length;
      blocked += data['sprint-actions'].actions.filter((a) => a.policyBlocked).length;
    }

    // Risk radar
    if (data['portfolio-discovery']) totalCalls += 3; // getVisibleJiraProjects + getConfluenceSpaces + atlassianUserInfo
    if (data['compliance-scan']) totalCalls += Object.keys(data['compliance-scan'].scansByProject).length * 2;
    if (data['risk-heatmap']) totalCalls += 0; // local computation
    if (data['policy-recommendations']) totalCalls += 0; // local computation

    return { totalCalls, blocked, piiScans: totalCalls, threats: 0 };
  }, [data]);

  // Build request params for each step (used by SecurityPipeline — display only, not for fetching)
  const getRequestParams = useCallback(
    (step: Step) => {
      const ctx = data.context;
      const arch = data.architecture;
      const industry = selectedIndustry === 'healthcare' ? 'healthcare' : 'financial_services';
      const complianceTags = ctx?.allLabels.filter((l) =>
        ['hipaa', 'soc2', 'fedramp', 'pci_dss', 'gdpr', 'ccpa'].includes(l)
      ) || [];

      // Deployment planning params
      if (step === 'context') return { projectKey, includeIssues: true, issueLimit: 10 };
      if (step === 'search') return { projectKey, query: `${projectKey} architecture compliance deployment` };
      if (step === 'health') return { projectKey };
      const projectContext = {
        projectKey, industry,
        useCaseDescription: (ctx?.project.description && ctx.project.description.length >= 10) ? ctx.project.description : 'AI-powered enterprise application',
        complianceTags, cloudProvider: 'aws',
        dataTypes: ctx?.detectedDataTypes || [], integrationTargets: ctx?.detectedIntegrations || [],
      };
      if (step === 'architecture') return { projectContext, includeDiagram: true, includeAlternatives: true };
      if (step === 'compliance') return { projectContext, detailLevel: 'detailed', includeChecklist: true };
      if (step === 'plan') return { projectContext, architecturePattern: arch?.pattern || 'conversational_agent', teamSize: 5, sprintLengthWeeks: 2, includeJiraTickets: true };
      if (step === 'actions') return { projectKey, enabledActions: ['label_issues', 'add_comment', 'transition_issue', 'create_confluence', 'create_jira'] };

      // Knowledge audit params
      if (step === 'space-discovery') return { spaceId };
      if (step === 'page-tree') return { spaceId, pageIds: data['space-discovery']?.pages.map((p) => p.id) ?? [] };
      if (step === 'comment-audit') return { pageIds: data['space-discovery']?.pages.map((p) => ({ id: p.id, title: p.title })) ?? [] };
      if (step === 'health-scoring') return { pages: data['space-discovery']?.pages ?? [], comments: data['comment-audit'] ?? {}, pageDetails: data['page-tree']?.pageDetails ?? {} };
      if (step === 'knowledge-actions') return { spaceId, actions: [] };

      // Sprint operations params
      if (step === 'sprint-context') return { projectKey };
      if (step === 'issue-deep-dive') return { projectKey };
      if (step === 'team-lookup') return { projectKey };
      if (step === 'sprint-actions') return { projectKey, enabledActions: ['add_worklog', 'edit_issue', 'create_link', 'add_comment'] };

      // Risk radar params
      if (step === 'portfolio-discovery') return { mode: 'all_projects' };
      if (step === 'compliance-scan') return { projectKeys: data['portfolio-discovery']?.projects.map((p) => p.key) ?? [], spaceKeys: data['portfolio-discovery']?.spaces.map((s) => s.key) ?? [] };
      if (step === 'risk-heatmap') return { projects: data['portfolio-discovery']?.projects ?? [], spaces: data['portfolio-discovery']?.spaces ?? [] };
      if (step === 'policy-recommendations') return { scores: data['risk-heatmap']?.scores ?? [] };

      return {};
    },
    [selectedIndustry, projectKey, spaceId, data]
  );

  // Core API caller — uses refs to avoid stale closures when called from handleStart
  const generateStep = useCallback(
    async (step: Step): Promise<void> => {
      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      const pk = projectKeyRef.current;
      const sid = spaceIdRef.current;
      const ind = industryRef.current;
      const data = dataRef.current;

      try {
        const industry = ind === 'healthcare' ? 'healthcare' : 'financial_services';

        // ---- Deployment Planning steps ----
        if (step === 'context') {
          const res = await fetch('/api/tools/read-context', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectKey: pk, includeIssues: true, issueLimit: 10 }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const ctxData: ProjectContextData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, context: ctxData } }));
        } else if (step === 'search') {
          const res = await fetch('/api/tools/cross-product-search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectKey: pk, query: `${pk} architecture compliance deployment` }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const searchData: SearchData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, search: searchData } }));
        } else if (step === 'health') {
          const res = await fetch('/api/tools/project-health', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectKey: pk }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const healthData: HealthData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, health: healthData } }));
        } else if (step === 'architecture') {
          const ctx = data.context;
          const complianceTags = ctx?.allLabels.filter((l) => ['hipaa', 'soc2', 'fedramp', 'pci_dss', 'gdpr', 'ccpa'].includes(l)) || [];
          const res = await fetch('/api/tools/generate-architecture', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectContext: {
                projectKey: pk, industry,
                useCaseDescription: (ctx?.project.description && ctx.project.description.length >= 10) ? ctx.project.description : 'AI-powered enterprise application',
                complianceTags, cloudProvider: 'aws',
                dataTypes: ctx?.detectedDataTypes || [], integrationTargets: ctx?.detectedIntegrations || [],
              },
              includeDiagram: true, includeAlternatives: true,
            }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const archData: ArchitectureData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, architecture: archData } }));
        } else if (step === 'compliance') {
          const ctx = data.context;
          const complianceTags = ctx?.allLabels.filter((l) => ['hipaa', 'soc2', 'fedramp', 'pci_dss', 'gdpr', 'ccpa'].includes(l)) || [];
          const res = await fetch('/api/tools/assess-compliance', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectContext: {
                projectKey: pk, industry,
                useCaseDescription: (ctx?.project.description && ctx.project.description.length >= 10) ? ctx.project.description : 'AI-powered enterprise application',
                complianceTags, cloudProvider: 'aws',
                dataTypes: ctx?.detectedDataTypes || [], integrationTargets: ctx?.detectedIntegrations || [],
              },
              detailLevel: 'detailed', includeChecklist: true,
            }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const compData: ComplianceData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, compliance: compData } }));
        } else if (step === 'plan') {
          const ctx = data.context;
          const arch = data.architecture;
          const complianceTags = ctx?.allLabels.filter((l) => ['hipaa', 'soc2', 'fedramp', 'pci_dss', 'gdpr', 'ccpa'].includes(l)) || [];
          const res = await fetch('/api/tools/create-plan', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectContext: {
                projectKey: pk, industry,
                useCaseDescription: (ctx?.project.description && ctx.project.description.length >= 10) ? ctx.project.description : 'AI-powered enterprise application',
                complianceTags, cloudProvider: 'aws',
                dataTypes: ctx?.detectedDataTypes || [], integrationTargets: ctx?.detectedIntegrations || [],
              },
              architecturePattern: arch?.pattern || 'conversational_agent',
              teamSize: 5, sprintLengthWeeks: 2, includeJiraTickets: true,
            }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const planData: PlanData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, plan: planData } }));

        // ---- Knowledge Audit steps ----
        } else if (step === 'space-discovery') {
          const res = await fetch('/api/tools/space-discovery', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spaceId: sid }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const sdData: SpaceDiscoveryData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, 'space-discovery': sdData } }));
        } else if (step === 'page-tree') {
          const pages = data['space-discovery']?.pages ?? [];
          const res = await fetch('/api/tools/page-tree', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spaceId: sid, pageIds: pages.map((p) => p.id) }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const ptData: PageTreeData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, 'page-tree': ptData } }));
        } else if (step === 'comment-audit') {
          const sd = data['space-discovery'];
          const pages = sd?.pages ?? [];
          const res = await fetch('/api/tools/comment-audit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageIds: pages.map((p) => ({ id: p.id, title: p.title })), upstreamSource: sd?.source }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const caData: CommentAuditData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, 'comment-audit': caData } }));
        } else if (step === 'health-scoring') {
          const pages = data['space-discovery']?.pages ?? [];
          const comments = data['comment-audit'] ?? { footerComments: [], inlineComments: [], totalComments: 0, unresolvedInline: 0, pagesWithComments: 0, pagesWithoutComments: 0, source: 'mock' as const };
          const pageDetails = data['page-tree']?.pageDetails ?? {};
          const res = await fetch('/api/tools/health-scoring', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pages, comments: { footerComments: comments.footerComments, inlineComments: comments.inlineComments }, pageDetails }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const hsData: HealthScoringData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, 'health-scoring': hsData } }));

        // ---- Sprint Operations steps ----
        } else if (step === 'sprint-context') {
          const res = await fetch('/api/tools/sprint-context', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectKey: pk }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const scData: SprintContextData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, 'sprint-context': scData } }));
        } else if (step === 'issue-deep-dive') {
          const res = await fetch('/api/tools/issue-deep-dive', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectKey: pk }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const idData: IssueDeepDiveData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, 'issue-deep-dive': idData } }));
        } else if (step === 'team-lookup') {
          const res = await fetch('/api/tools/team-lookup', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectKey: pk }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const tlData: TeamLookupData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, 'team-lookup': tlData } }));

        // ---- Risk Radar steps ----
        } else if (step === 'portfolio-discovery') {
          const res = await fetch('/api/tools/portfolio-discovery', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const pdData: PortfolioDiscoveryData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, 'portfolio-discovery': pdData } }));
        } else if (step === 'compliance-scan') {
          const portfolio = data['portfolio-discovery'];
          const res = await fetch('/api/tools/compliance-scan', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectKeys: portfolio?.projects.map((p) => p.key) ?? [],
              spaceKeys: portfolio?.spaces.map((s) => s.key) ?? [],
            }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const csData: ComplianceScanData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, 'compliance-scan': csData } }));
        } else if (step === 'risk-heatmap') {
          const portfolio = data['portfolio-discovery'];
          const compScan = data['compliance-scan'];
          const res = await fetch('/api/tools/risk-scoring', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projects: portfolio?.projects.map((p) => ({ key: p.key, name: p.name, issueCount: p.issueCount })) ?? [],
              spaces: portfolio?.spaces.map((s) => ({ key: s.key, name: s.name, pageCount: s.pageCount })) ?? [],
              hits: compScan?.hits ?? [],
            }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const rsData: RiskScoringData = await res.json();
          setState((prev) => ({ ...prev, data: { ...prev.data, 'risk-heatmap': rsData, 'policy-recommendations': rsData } }));
        } else if (step === 'policy-recommendations') {
          // Data is populated by the risk-heatmap step — skip if not yet available
          if (!dataRef.current['risk-heatmap']) return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setState((prev) => ({ ...prev, error: msg }));
      } finally {
        setState((prev) => ({ ...prev, isGenerating: false }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Agent Actions handler (deployment planning)
  const handleExecuteActions = useCallback(async (enabledActions: string[]) => {
    setState((prev) => ({ ...prev, isGenerating: true, error: null }));
    try {
      const data = dataRef.current;
      const pk = projectKeyRef.current;
      const architectureTitle = data.architecture
        ? `${data.context?.project.name ?? pk} - Architecture: ${data.architecture.patternName}`
        : undefined;
      const architectureContent = data.architecture
        ? [
            `# ${architectureTitle}`, '',
            `## Pattern: ${data.architecture.patternName}`, '',
            data.architecture.rationale, '',
            '## Components',
            ...data.architecture.components.map((c) => `- **${c.name}**: ${c.description}`), '',
            '## Security Considerations',
            ...data.architecture.securityConsiderations.map((s) => `- ${s}`),
          ].join('\n')
        : undefined;

      const issueKey = data.context?.issues?.[0]?.key;
      const jiraTickets = data.plan?.jiraTickets?.slice(0, 3).map((t) => ({
        summary: t.summary, description: t.description, type: t.type,
      }));

      const res = await fetch('/api/tools/agent-actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey: pk, enabledActions, issueKey, architectureTitle, architectureContent, jiraTickets }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const actionsData: AgentActionsData = await res.json();
      setState((prev) => ({ ...prev, data: { ...prev.data, actions: actionsData } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: msg }));
    } finally {
      setState((prev) => ({ ...prev, isGenerating: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Knowledge Actions handler
  const handleExecuteKnowledgeActions = useCallback(async (enabledActions: string[]) => {
    setState((prev) => ({ ...prev, isGenerating: true, error: null }));
    try {
      const data = dataRef.current;
      const sid = spaceIdRef.current;
      const pages = data['space-discovery']?.pages ?? [];
      const scores = data['health-scoring']?.pageScores ?? [];
      const stalePage = scores.find((s) => s.status === 'stale' || s.status === 'critical');
      const thinPage = scores.find((s) => s.factors.wordCount < 50);

      const actions: Array<Record<string, unknown>> = [];
      if (enabledActions.includes('footer_comment') && stalePage) {
        actions.push({
          type: 'footer_comment', pageId: stalePage.pageId,
          pageTitle: stalePage.title,
          content: `[Knowledge Audit] This page scored ${stalePage.score}/100. Recommendations: ${stalePage.recommendations.join(', ')}`,
        });
      }
      if (enabledActions.includes('inline_comment') && thinPage) {
        actions.push({
          type: 'inline_comment', pageId: thinPage.pageId,
          pageTitle: thinPage.title,
          content: '[Knowledge Audit] This section needs expansion — word count is below minimum threshold.',
          textSelection: thinPage.title,
        });
      }
      if (enabledActions.includes('update_page') && pages.length > 0) {
        actions.push({
          type: 'update_page', pageId: pages[0].id,
          pageTitle: pages[0].title,
          content: `Last audited: ${new Date().toISOString().split('T')[0]}`,
        });
      }

      const res = await fetch('/api/tools/knowledge-actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId: sid, actions }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const kaData: KnowledgeActionsData = await res.json();
      setState((prev) => ({ ...prev, data: { ...prev.data, 'knowledge-actions': kaData } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: msg }));
    } finally {
      setState((prev) => ({ ...prev, isGenerating: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sprint Actions handler
  const handleExecuteSprintActions = useCallback(async (enabledActions: string[]) => {
    setState((prev) => ({ ...prev, isGenerating: true, error: null }));
    try {
      const data = dataRef.current;
      const pk = projectKeyRef.current;
      const issues = data['issue-deep-dive']?.issues ?? [];
      const members = data['team-lookup']?.members ?? [];
      const firstIssue = issues[0];
      const firstMember = members[0];

      const res = await fetch('/api/tools/sprint-actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectKey: pk,
          enabledActions,
          issueKey: firstIssue?.key,
          targetIssueKey: issues[1]?.key,
          assigneeAccountId: firstMember?.accountId,
          linkType: 'Blocks',
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const saData: SprintActionsData = await res.json();
      setState((prev) => ({ ...prev, data: { ...prev.data, 'sprint-actions': saData } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: msg }));
    } finally {
      setState((prev) => ({ ...prev, isGenerating: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = async (workflow: WorkflowId, industry: Industry) => {
    const sc = SCENARIOS.find((s) => s.industry === industry)!;
    const pk = sc.projectKey;
    const sid = sc.spaceId ?? '';
    industryRef.current = industry;
    workflowRef.current = workflow;
    projectKeyRef.current = pk;
    spaceIdRef.current = sid;

    setSelectedFeature(null);

    const config = getWorkflowConfig(workflow);
    const firstStep = config.stepOrder[1]; // [0] is 'select', [1] is first real step

    setState({
      selectedWorkflow: workflow,
      selectedIndustry: industry,
      currentStep: firstStep,
      isGenerating: false,
      error: null,
      data: { ...EMPTY_DATA },
    });

    await generateStep(firstStep);
  };

  const handleStartRiskRadar = async () => {
    setSelectedFeature(null);

    const config = getWorkflowConfig('risk-radar');
    const firstStep = config.stepOrder[1];

    setState({
      selectedWorkflow: 'risk-radar',
      selectedIndustry: null,
      currentStep: firstStep,
      isGenerating: false,
      error: null,
      data: { ...EMPTY_DATA },
    });

    await generateStep(firstStep);
  };

  const handleSelectFeature = (feature: FeatureId) => {
    setSelectedFeature(feature);
    setState({
      selectedWorkflow: null,
      selectedIndustry: null,
      currentStep: 'select',
      isGenerating: false,
      error: null,
      data: { ...EMPTY_DATA },
    });
  };

  const handleStartOver = () => {
    setSelectedFeature(null);
    setState({
      selectedWorkflow: null,
      selectedIndustry: null,
      currentStep: 'select',
      isGenerating: false,
      error: null,
      data: { ...EMPTY_DATA },
    });
  };

  const handleNextStep = async () => {
    const idx = stepOrder.indexOf(currentStep);
    const next = stepOrder[idx + 1];
    if (!next) return;

    if (next === 'complete') {
      setState((prev) => ({ ...prev, currentStep: 'complete' }));
    } else if (next === 'policy-recommendations' && data['risk-heatmap']) {
      // Policy recommendations shares data with risk-heatmap — no fetch needed
      setState((prev) => ({ ...prev, currentStep: next }));
    } else if (ACTION_STEPS.has(next)) {
      setState((prev) => ({ ...prev, currentStep: next }));
    } else {
      setState((prev) => ({ ...prev, currentStep: next }));
      await generateStep(next);
    }
  };

  // Determine if the current step has data (for action steps, check their specific data key)
  const currentStepHasData = (() => {
    if (currentStep === 'actions') return data.actions !== null;
    if (currentStep === 'knowledge-actions') return data['knowledge-actions'] !== null;
    if (currentStep === 'sprint-actions') return data['sprint-actions'] !== null;
    if (currentStep === 'policy-recommendations') return data['policy-recommendations'] !== null;
    return completedSteps.has(currentStep);
  })();

  const showNavigation =
    selectedWorkflow &&
    currentStep !== 'select' &&
    currentStep !== 'complete' &&
    !isGenerating &&
    !selectedFeature &&
    (ACTION_STEPS.has(currentStep) ? currentStepHasData : completedSteps.has(currentStep));

  // Rendering: feature views take over the full page
  const isFeatureView = selectedFeature !== null;

  return (
    <main className="min-h-screen">
      <Header isRunning={isGenerating} />

      {/* Step progress bar for workflow views */}
      {selectedWorkflow && currentStep !== 'select' && !isFeatureView && (
        <>
          <StepProgress currentStep={currentStep} completedSteps={completedSteps} steps={stepDefinitions} />
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

        {/* ======= Feature Views (non-step-based) ======= */}
        {selectedFeature === 'threat-simulator' && (
          <SecuritySimulator onBack={handleStartOver} />
        )}
        {selectedFeature === 'governance' && (
          <GovernanceControlRoom onBack={handleStartOver} />
        )}

        {/* ======= Landing ======= */}
        {!isFeatureView && currentStep === 'select' && (
          <HeroLanding
            onStart={handleStart}
            onSelectFeature={handleSelectFeature}
            onStartRiskRadar={handleStartRiskRadar}
          />
        )}

        {/* ---- Deployment Planning Steps ---- */}
        {!isFeatureView && currentStep === 'context' && (
          <ContextStep
            data={data.context}
            isGenerating={isGenerating}
            projectKey={projectKey}
            industry={selectedIndustry || 'healthcare'}
            requestParams={getRequestParams('context')}
          />
        )}
        {!isFeatureView && currentStep === 'search' && (
          <SearchStep results={data.search?.results ?? null} isGenerating={isGenerating} requestParams={getRequestParams('search')} />
        )}
        {!isFeatureView && currentStep === 'health' && (
          <HealthStep data={data.health} isGenerating={isGenerating} requestParams={getRequestParams('health')} />
        )}
        {!isFeatureView && currentStep === 'architecture' && (
          <ArchitectureStep data={data.architecture} isGenerating={isGenerating} requestParams={getRequestParams('architecture')} />
        )}
        {!isFeatureView && currentStep === 'compliance' && (
          <ComplianceStep data={data.compliance} isGenerating={isGenerating} requestParams={getRequestParams('compliance')} />
        )}
        {!isFeatureView && currentStep === 'plan' && (
          <PlanStep data={data.plan} isGenerating={isGenerating} requestParams={getRequestParams('plan')} />
        )}
        {!isFeatureView && currentStep === 'actions' && (
          <ActionsStep data={data.actions} isGenerating={isGenerating} requestParams={getRequestParams('actions')} onExecuteActions={handleExecuteActions} />
        )}

        {/* ---- Knowledge Audit Steps ---- */}
        {!isFeatureView && currentStep === 'space-discovery' && (
          <SpaceDiscoveryStep data={data['space-discovery']} isGenerating={isGenerating} requestParams={getRequestParams('space-discovery')} />
        )}
        {!isFeatureView && currentStep === 'page-tree' && (
          <PageTreeStep data={data['page-tree']} isGenerating={isGenerating} requestParams={getRequestParams('page-tree')} />
        )}
        {!isFeatureView && currentStep === 'comment-audit' && (
          <CommentAuditStep data={data['comment-audit']} isGenerating={isGenerating} requestParams={getRequestParams('comment-audit')} />
        )}
        {!isFeatureView && currentStep === 'health-scoring' && (
          <HealthScoringStep data={data['health-scoring']} isGenerating={isGenerating} requestParams={getRequestParams('health-scoring')} />
        )}
        {!isFeatureView && currentStep === 'knowledge-actions' && (
          <KnowledgeActionsStep data={data['knowledge-actions']} isGenerating={isGenerating} requestParams={getRequestParams('knowledge-actions')} onExecuteActions={handleExecuteKnowledgeActions} />
        )}

        {/* ---- Sprint Operations Steps ---- */}
        {!isFeatureView && currentStep === 'sprint-context' && (
          <SprintContextStep data={data['sprint-context']} isGenerating={isGenerating} requestParams={getRequestParams('sprint-context')} />
        )}
        {!isFeatureView && currentStep === 'issue-deep-dive' && (
          <IssueDeepDiveStep data={data['issue-deep-dive']} isGenerating={isGenerating} requestParams={getRequestParams('issue-deep-dive')} />
        )}
        {!isFeatureView && currentStep === 'team-lookup' && (
          <TeamLookupStep data={data['team-lookup']} isGenerating={isGenerating} requestParams={getRequestParams('team-lookup')} />
        )}
        {!isFeatureView && currentStep === 'sprint-actions' && (
          <SprintActionsStep data={data['sprint-actions']} isGenerating={isGenerating} requestParams={getRequestParams('sprint-actions')} onExecuteActions={handleExecuteSprintActions} />
        )}

        {/* ---- Risk Radar Steps ---- */}
        {!isFeatureView && currentStep === 'portfolio-discovery' && (
          <PortfolioDiscoveryStep data={data['portfolio-discovery']} isGenerating={isGenerating} requestParams={getRequestParams('portfolio-discovery')} />
        )}
        {!isFeatureView && currentStep === 'compliance-scan' && (
          <ComplianceScanStep data={data['compliance-scan']} isGenerating={isGenerating} requestParams={getRequestParams('compliance-scan')} />
        )}
        {!isFeatureView && currentStep === 'risk-heatmap' && (
          <RiskHeatmapStep data={data['risk-heatmap']} isGenerating={isGenerating} requestParams={getRequestParams('risk-heatmap')} />
        )}
        {!isFeatureView && currentStep === 'policy-recommendations' && (
          <PolicyRecommendationStep data={data['policy-recommendations']} isGenerating={isGenerating} requestParams={getRequestParams('policy-recommendations')} />
        )}

        {/* Complete */}
        {!isFeatureView && currentStep === 'complete' && (
          <CompleteStep data={data} workflowId={selectedWorkflow!} onStartOver={handleStartOver} />
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
                ACTION_STEPS.has(currentStep)
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-anthropic-900 text-white hover:bg-anthropic-800'
              }`}
            >
              {ACTION_STEPS.has(currentStep) ? 'Complete Demo' : 'Next Step'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
