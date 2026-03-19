// TypeScript interfaces for all API responses

// ---- Workflow system ----
export type WorkflowId = 'deployment-planning' | 'knowledge-audit' | 'sprint-operations' | 'risk-radar';

// ---- Feature system (non-step-based interactive views) ----
export type FeatureId = 'threat-simulator' | 'governance';

// ---- Security Threat Simulator types ----
export interface ThreatIndicator {
  strategy: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  fieldPath: string;
  matchedContent?: string;
}

export interface ThreatScanResult {
  clean: boolean;
  indicators: ThreatIndicator[];
  highestSeverity: ThreatIndicator['severity'] | null;
  scanDurationMs: number;
}

export interface PiiMatch {
  type: string;
  fieldPath: string;
  start: number;
  end: number;
}

export interface PiiScanResult {
  detected: boolean;
  matches: PiiMatch[];
}

export interface ScanApiResult {
  threats: ThreatScanResult;
  pii: PiiScanResult;
  shouldBlock: boolean;
  redactedText?: string;
}

// ---- Governance Control Room types ----
export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'access' | 'security' | 'compliance';
  rules: PolicyRule[];
}

export interface PolicyRule {
  name: string;
  description: string;
  priority: number;
  conditions: {
    servers?: string[];
    tools?: string[];
    users?: string[];
  };
  action: 'allow' | 'deny' | 'require_approval' | 'log_only';
  modifiers?: {
    redactPII?: boolean;
    maxCallsPerMinute?: number;
  };
}

export type PolicyDecision = 'allow' | 'deny' | 'require_approval' | 'log_only';

export interface ToolCallSimulation {
  toolName: string;
  displayName: string;
  type: 'read' | 'write';
  exampleParams: Record<string, unknown>;
  decision: PolicyDecision;
  matchedRule?: string;
  matchedTemplate?: string;
}

// ---- Risk Radar types ----
export type RiskRadarStep = 'portfolio-discovery' | 'compliance-scan' | 'risk-heatmap' | 'policy-recommendations';

export interface PortfolioProject {
  key: string;
  name: string;
  description?: string;
  lead?: string;
  issueCount: number;
  lastActivity?: string;
}

export interface PortfolioSpace {
  key: string;
  name: string;
  description?: string;
  pageCount: number;
  lastActivity?: string;
}

export interface PortfolioUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
}

export interface PortfolioDiscoveryData {
  projects: PortfolioProject[];
  spaces: PortfolioSpace[];
  user: PortfolioUser;
  source: 'gateway' | 'mock';
}

export interface ComplianceHit {
  keyword: string;
  source: 'jira' | 'confluence';
  projectOrSpace: string;
  title: string;
  key?: string;
  excerpt?: string;
}

export interface ComplianceScanData {
  hits: ComplianceHit[];
  scansByProject: Record<string, number>;
  scansByKeyword: Record<string, number>;
  source: 'gateway' | 'mock';
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskDimension {
  dimension: string;
  score: number;
  level: RiskLevel;
  details: string;
}

export interface ProjectRiskScore {
  key: string;
  name: string;
  type: 'project' | 'space';
  overallScore: number;
  overallLevel: RiskLevel;
  dimensions: RiskDimension[];
}

export interface RiskScoringData {
  scores: ProjectRiskScore[];
  recommendations: PolicyRecommendation[];
}

export interface PolicyRecommendation {
  projectKey: string;
  projectName: string;
  templateId: string;
  templateName: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

// ---- Steps per workflow ----
export type DeploymentStep = 'context' | 'search' | 'health' | 'architecture' | 'compliance' | 'plan' | 'actions';
export type KnowledgeAuditStep = 'space-discovery' | 'page-tree' | 'comment-audit' | 'health-scoring' | 'knowledge-actions';
export type SprintOpsStep = 'sprint-context' | 'issue-deep-dive' | 'team-lookup' | 'sprint-actions';

export type WorkflowStep = DeploymentStep | KnowledgeAuditStep | SprintOpsStep | RiskRadarStep;
export type Step = 'select' | WorkflowStep | 'complete';

export type Industry = 'healthcare' | 'financial';

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
  type: string;
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

// ---- Knowledge Base Audit types ----
export interface SpaceInfo {
  id: string;
  key: string;
  name: string;
  type: string;
  description?: string;
}

export interface PageInfo {
  id: string;
  title: string;
  spaceId: string;
  parentId?: string;
  status: string;
  lastModified?: string;
  authorName?: string;
  version?: number;
  wordCount?: number;
  depth?: number;
}

export interface SpaceDiscoveryData {
  spaces: SpaceInfo[];
  selectedSpace: SpaceInfo;
  pages: PageInfo[];
  source: 'gateway' | 'mock';
}

export interface PageTreeNode {
  page: PageInfo;
  children: PageTreeNode[];
  depth: number;
}

export interface PageTreeData {
  rootPages: PageTreeNode[];
  totalPages: number;
  maxDepth: number;
  orphanCount: number;
  pageDetails: Record<string, { wordCount: number; lastModified?: string }>;
  source: 'gateway' | 'mock';
}

export interface CommentInfo {
  id: string;
  pageId: string;
  pageTitle: string;
  author: string;
  body: string;
  created: string;
  type: 'footer' | 'inline';
  resolved?: boolean;
  replyCount?: number;
  replies?: CommentInfo[];
}

export interface CommentAuditData {
  footerComments: CommentInfo[];
  inlineComments: CommentInfo[];
  totalComments: number;
  unresolvedInline: number;
  pagesWithComments: number;
  pagesWithoutComments: number;
  source: 'gateway' | 'mock';
}

export interface PageHealthScore {
  pageId: string;
  title: string;
  score: number;
  factors: {
    staleness: number;
    depth: number;
    commentActivity: number;
    wordCount: number;
    hasChildren: boolean;
  };
  status: 'healthy' | 'needs-attention' | 'stale' | 'critical';
  recommendations: string[];
}

export interface HealthScoringData {
  pageScores: PageHealthScore[];
  averageScore: number;
  healthyCount: number;
  needsAttentionCount: number;
  staleCount: number;
  criticalCount: number;
}

export interface KnowledgeActionResult {
  type: 'footer_comment' | 'inline_comment' | 'update_page';
  description: string;
  toolUsed: string;
  success: boolean;
  policyBlocked?: boolean;
  approvalRequired?: boolean;
  blockReason?: string;
  details?: Record<string, unknown>;
}

export interface KnowledgeActionsData {
  actions: KnowledgeActionResult[];
}

// ---- Sprint Operations types ----
export interface ProjectMeta {
  key: string;
  name: string;
  description?: string;
  lead?: string;
  issueTypes: Array<{ id: string; name: string; description?: string }>;
  fieldSchemas: Array<{ fieldId: string; name: string; type: string; required: boolean }>;
}

export interface SprintContextData {
  projects: ProjectMeta[];
  selectedProject: ProjectMeta;
  source: 'gateway' | 'mock';
}

export interface IssueDeepDiveIssue {
  key: string;
  summary: string;
  description?: string;
  type: string;
  status: string;
  priority?: string;
  assignee?: string;
  labels: string[];
  created?: string;
  updated?: string;
  timeSpent?: string;
  issueLinks: Array<{
    type: string;
    direction: 'inward' | 'outward';
    linkedIssueKey: string;
    linkedIssueSummary: string;
    linkedIssueStatus: string;
  }>;
  remoteLinks: Array<{
    title: string;
    url: string;
  }>;
}

export interface IssueLinkType {
  id: string;
  name: string;
  inward: string;
  outward: string;
}

export interface IssueDeepDiveData {
  issues: IssueDeepDiveIssue[];
  linkTypes: IssueLinkType[];
  totalInProgress: number;
  totalBlocked: number;
  totalTimeSpent: string;
  source: 'gateway' | 'mock';
}

export interface TeamMember {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
  avatarUrl?: string;
}

export interface TeamLookupData {
  members: TeamMember[];
  searchQuery: string;
  source: 'gateway' | 'mock';
}

export interface SprintActionResult {
  type: 'add_worklog' | 'edit_issue' | 'create_link' | 'add_comment';
  description: string;
  toolUsed: string;
  success: boolean;
  policyBlocked?: boolean;
  approvalRequired?: boolean;
  blockReason?: string;
  details?: Record<string, unknown>;
}

export interface SprintActionsData {
  actions: SprintActionResult[];
}

// ---- Workflow-aware DemoState ----
export interface DemoData {
  // Deployment planning
  context: ProjectContextData | null;
  search: SearchData | null;
  health: HealthData | null;
  architecture: ArchitectureData | null;
  compliance: ComplianceData | null;
  plan: PlanData | null;
  actions: AgentActionsData | null;
  // Knowledge audit
  'space-discovery': SpaceDiscoveryData | null;
  'page-tree': PageTreeData | null;
  'comment-audit': CommentAuditData | null;
  'health-scoring': HealthScoringData | null;
  'knowledge-actions': KnowledgeActionsData | null;
  // Sprint operations
  'sprint-context': SprintContextData | null;
  'issue-deep-dive': IssueDeepDiveData | null;
  'team-lookup': TeamLookupData | null;
  'sprint-actions': SprintActionsData | null;
  // Risk radar
  'portfolio-discovery': PortfolioDiscoveryData | null;
  'compliance-scan': ComplianceScanData | null;
  'risk-heatmap': RiskScoringData | null;
  'policy-recommendations': RiskScoringData | null;
}

export interface DemoState {
  selectedWorkflow: WorkflowId | null;
  selectedIndustry: Industry | null;
  currentStep: Step;
  isGenerating: boolean;
  error: string | null;
  data: DemoData;
}
