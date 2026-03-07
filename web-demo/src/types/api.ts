// TypeScript interfaces for all API responses

// Confluence context for Architecture/Compliance enrichment
export interface ConfluenceContextPage {
  title: string;
  excerpt: string;
  spaceKey?: string;
  url?: string;
  lastModified?: string;
}

// Compliance doc coverage
export interface ComplianceDocCoverage {
  framework: string;
  existingDocs: ConfluenceContextPage[];
  coverage: 'full' | 'partial' | 'missing';
}

// Agent Actions step
export type ActionType = 'label_issues' | 'add_comment' | 'transition_issue' | 'create_confluence' | 'create_jira';
export interface ActionResult {
  type: ActionType;
  description: string;
  toolUsed: string;
  success: boolean;
  policyBlocked?: boolean;
  approvalRequired?: boolean;
  blockReason?: string;
  details?: Record<string, unknown>;
}
export interface AgentActionsData {
  actions: ActionResult[];
}

// Security pipeline stage for visualization
export type PipelineStageStatus = 'pending' | 'processing' | 'passed' | 'blocked';
export interface PipelineStage {
  name: string;
  status: PipelineStageStatus;
  detail?: string;
}

export interface ProjectContextData {
  project: {
    key: string;
    name: string;
    description?: string;
    lead?: string;
  };
  issues: Issue[];
  detectedCompliance: string[];
  detectedIntegrations: string[];
  detectedDataTypes: string[];
  allLabels: string[];
  summary: {
    totalIssues: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

export interface Issue {
  key: string;
  summary: string;
  description?: string;
  type: string;
  status: string;
  labels: string[];
  priority?: string;
}

export interface ArchitectureData {
  pattern: string;
  patternName: string;
  rationale: string;
  components: ArchitectureComponent[];
  dataFlow: string[];
  mermaidDiagram?: string;
  securityConsiderations: string[];
  scalingConsiderations: string[];
  alternatives?: Array<{
    pattern: string;
    rationale: string;
  }>;
  confluenceContext?: ConfluenceContextPage[];
}

export interface ArchitectureComponent {
  name: string;
  description: string;
  services: Record<string, string[]>;
  considerations: string[];
}

export interface ComplianceData {
  applicableFrameworks: ComplianceFramework[];
  keyRequirements: ComplianceRequirement[];
  riskAreas: RiskArea[];
  checklist?: ChecklistItem[];
  documentCoverage?: ComplianceDocCoverage[];
}

export interface ComplianceFramework {
  framework: string;
  name: string;
  applicabilityReason: string;
  priority: 'required' | 'recommended';
}

export interface ComplianceRequirement {
  category: string;
  requirement: string;
  implementation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface RiskArea {
  area: string;
  risk: string;
  mitigation: string;
}

export interface ChecklistItem {
  item: string;
  category: string;
  completed: boolean;
}

export interface PlanData {
  summary: {
    totalWeeks: number;
    totalSprints: number;
    teamSize: number;
    phases: number;
  };
  phases: Phase[];
  skillRequirements: SkillRequirement[];
  jiraTickets?: JiraTicket[];
}

export interface Phase {
  name: string;
  description: string;
  durationWeeks: number;
  sprints: Array<{
    number: number;
    focus: string;
    deliverables: string[];
  }>;
  milestones: string[];
  riskFactors: string[];
}

export interface SkillRequirement {
  skill: string;
  level: string;
  roles: string[];
}

export interface JiraTicket {
  type: 'epic' | 'story' | 'task';
  summary: string;
  description: string;
  labels: string[];
  estimateHours?: number;
}

export interface SearchResultData {
  type: 'jira' | 'confluence';
  key?: string;
  title: string;
  excerpt: string;
  url?: string;
  issueType?: string;
  status?: string;
  spaceKey?: string;
}

export interface SearchData {
  results: SearchResultData[];
  source: 'gateway' | 'mock';
}

export interface HealthData {
  readinessScore: number;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  openCount: number;
  highPriorityCount: number;
  overdueCount: number;
  blockedCount: number;
  riskFlags: string[];
  source: 'gateway' | 'mock';
}

export type Step = 'select' | 'context' | 'search' | 'health' | 'architecture' | 'compliance' | 'plan' | 'actions' | 'complete';
export type Industry = 'healthcare' | 'financial';

export interface DemoState {
  selectedIndustry: Industry | null;
  currentStep: Step;
  isGenerating: boolean;
  error: string | null;
  data: {
    context: ProjectContextData | null;
    search: SearchData | null;
    health: HealthData | null;
    architecture: ArchitectureData | null;
    compliance: ComplianceData | null;
    plan: PlanData | null;
    actions: AgentActionsData | null;
  };
}
