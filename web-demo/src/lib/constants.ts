import type { Step, Industry, WorkflowId, WorkflowStep } from '@/types/api';

// ---- Step Definition ----
export interface StepDefinition {
  key: WorkflowStep;
  label: string;
  toolName: string;
  toolDescription: string;
}

// ---- Workflow Config ----
export interface WorkflowConfig {
  id: WorkflowId;
  name: string;
  description: string;
  persona: string;
  toolCount: number;
  steps: StepDefinition[];
  stepOrder: Step[];
  selectorType: 'jira-project' | 'confluence-space' | 'none';
}

// ---- Deployment Planning (existing) ----
const DEPLOYMENT_STEPS: StepDefinition[] = [
  { key: 'context', label: 'Project Context', toolName: 'read_project_context', toolDescription: 'Read and analyze Jira project backlog' },
  { key: 'search', label: 'Cross-Product Search', toolName: 'cross_product_search', toolDescription: 'Search across Jira and Confluence' },
  { key: 'health', label: 'Project Health', toolName: 'project_health', toolDescription: 'Assess project readiness from issue data' },
  { key: 'architecture', label: 'Architecture', toolName: 'generate_architecture', toolDescription: 'Generate architecture with Confluence context' },
  { key: 'compliance', label: 'Compliance', toolName: 'assess_compliance', toolDescription: 'Assess compliance with doc coverage audit' },
  { key: 'plan', label: 'Implementation', toolName: 'create_implementation_plan', toolDescription: 'Create phased implementation plan' },
  { key: 'actions', label: 'Agent Actions', toolName: 'agent_actions', toolDescription: 'Execute write operations via Rovo tools' },
];

// ---- Knowledge Base Audit ----
const KNOWLEDGE_AUDIT_STEPS: StepDefinition[] = [
  { key: 'space-discovery', label: 'Space Discovery', toolName: 'space_discovery', toolDescription: 'List spaces and enumerate all pages' },
  { key: 'page-tree', label: 'Page Tree', toolName: 'page_tree_analysis', toolDescription: 'Traverse page hierarchy and map structure' },
  { key: 'comment-audit', label: 'Comment Audit', toolName: 'comment_activity_audit', toolDescription: 'Audit footer/inline comments per page' },
  { key: 'health-scoring', label: 'Health Scoring', toolName: 'knowledge_health_scoring', toolDescription: 'Compute per-page health scores' },
  { key: 'knowledge-actions', label: 'Agent Actions', toolName: 'knowledge_actions', toolDescription: 'Add audit comments and flag stale pages' },
];

// ---- Risk Radar ----
const RISK_RADAR_STEPS: StepDefinition[] = [
  { key: 'portfolio-discovery', label: 'Portfolio Discovery', toolName: 'portfolio_discovery', toolDescription: 'Enumerate all projects, spaces, and users' },
  { key: 'compliance-scan', label: 'Compliance Scan', toolName: 'compliance_scanning', toolDescription: 'Scan all projects for compliance keywords' },
  { key: 'risk-heatmap', label: 'Risk Heatmap', toolName: 'risk_heatmap', toolDescription: 'Compute risk scores and visualize heatmap' },
  { key: 'policy-recommendations', label: 'Policy Recommendations', toolName: 'policy_recommendations', toolDescription: 'Recommend gateway policies per project' },
];

// ---- Sprint Operations ----
const SPRINT_OPS_STEPS: StepDefinition[] = [
  { key: 'sprint-context', label: 'Sprint Context', toolName: 'sprint_context', toolDescription: 'Get project metadata and field schemas' },
  { key: 'issue-deep-dive', label: 'Issue Deep Dive', toolName: 'issue_deep_dive', toolDescription: 'Fetch in-progress issues with links' },
  { key: 'team-lookup', label: 'Team Lookup', toolName: 'team_resolution', toolDescription: 'Look up team member account IDs' },
  { key: 'sprint-actions', label: 'Sprint Actions', toolName: 'sprint_actions', toolDescription: 'Log work, assign, link, and comment' },
];

export const WORKFLOWS: WorkflowConfig[] = [
  {
    id: 'deployment-planning',
    name: 'AI Deployment Planning',
    description: 'Analyze a Jira project backlog, search Confluence docs, assess compliance, generate architecture, and create implementation plans.',
    persona: 'Solutions Architect',
    toolCount: 14,
    steps: DEPLOYMENT_STEPS,
    stepOrder: ['select', 'context', 'search', 'health', 'architecture', 'compliance', 'plan', 'actions', 'complete'],
    selectorType: 'jira-project',
  },
  {
    id: 'knowledge-audit',
    name: 'Knowledge Base Audit',
    description: 'Audit Confluence documentation for completeness, freshness, and review activity — then annotate gaps directly.',
    persona: 'Knowledge Manager',
    toolCount: 8,
    steps: KNOWLEDGE_AUDIT_STEPS,
    stepOrder: ['select', 'space-discovery', 'page-tree', 'comment-audit', 'health-scoring', 'knowledge-actions', 'complete'],
    selectorType: 'confluence-space',
  },
  {
    id: 'sprint-operations',
    name: 'Sprint Operations',
    description: 'Review sprint progress, resolve team assignments, log work estimates, and link cross-project dependencies.',
    persona: 'Scrum Master',
    toolCount: 7,
    steps: SPRINT_OPS_STEPS,
    stepOrder: ['select', 'sprint-context', 'issue-deep-dive', 'team-lookup', 'sprint-actions', 'complete'],
    selectorType: 'jira-project',
  },
  {
    id: 'risk-radar',
    name: 'Cross-Project Risk Radar',
    description: 'Scan all Jira projects and Confluence spaces for compliance risks, visualize an enterprise heatmap, and recommend gateway policies.',
    persona: 'Compliance Officer',
    toolCount: 5,
    steps: RISK_RADAR_STEPS,
    stepOrder: ['select', 'portfolio-discovery', 'compliance-scan', 'risk-heatmap', 'policy-recommendations', 'complete'],
    selectorType: 'none',
  },
];

export function getWorkflowConfig(id: WorkflowId): WorkflowConfig {
  return WORKFLOWS.find((w) => w.id === id)!;
}

export function getStepDefinitions(workflowId: WorkflowId): StepDefinition[] {
  return getWorkflowConfig(workflowId).steps;
}

// Backward-compatible export for existing code
export const STEP_DEFINITIONS = DEPLOYMENT_STEPS;

export const TOOL_NARRATIVES: Record<string, string> = {
  // Deployment planning
  read_project_context:
    'This call flows through the MCP Security Gateway to the Atlassian Rovo MCP Server, which reads the project backlog from Jira Cloud in real time. Every request passes through the gateway\'s security pipeline \u2014 prompt injection scanning, policy enforcement, PII detection, and audit logging \u2014 before reaching Jira. The response is analyzed for compliance indicators, integration targets, and data classifications.',
  cross_product_search:
    'The gateway proxies a Rovo Search call through the Atlassian Rovo MCP Server, searching across both Jira and Confluence in a single query. Each request passes through injection scanning, policy evaluation, and audit logging. JQL queries supplement Rovo Search for reliable Jira coverage, and Confluence results are filtered to the project\'s configured space.',
  project_health:
    'Four parallel JQL queries run through the gateway to assess project readiness: open issues, high-priority items, overdue tickets, and blocked work. Each query is independently policy-checked and audit-logged. The readiness score is computed from overdue, blocked, and critical issue counts.',
  generate_architecture:
    'The agent searches Confluence for existing architecture documentation using CQL, then reads the top matches with getConfluencePage. The knowledge base recommends a pattern, and Confluence context is shown alongside the recommendation \u2014 demonstrating how the agent discovers your team\'s existing docs.',
  assess_compliance:
    'The agent searches Confluence for compliance documentation per applicable framework using CQL queries. It identifies which frameworks have existing docs, partial coverage, or missing documentation \u2014 acting as an automated compliance auditor across your Confluence knowledge base.',
  create_implementation_plan:
    'The MCP server generates a phased implementation plan calibrated to the architecture pattern\'s complexity. It creates sprint-level timelines, identifies required skills, estimates effort, and generates Jira ticket templates ready for import.',
  agent_actions:
    'Write operations flow through the full security pipeline. The agent can label issues (editJiraIssue), add comments (addCommentToJiraIssue), transition statuses (transitionJiraIssue), create Confluence pages, and create Jira tickets. Each write is individually policy-checked \u2014 some may be blocked or require approval.',
  // Knowledge audit
  space_discovery:
    'The agent lists all Confluence spaces via getConfluenceSpaces, then enumerates every page in the selected space using getPagesInConfluenceSpace. Each call flows through the gateway\'s security pipeline with audit logging. This builds a complete inventory of the knowledge base.',
  page_tree_analysis:
    'For each top-level page, the agent calls getConfluencePageDescendants to build a full page hierarchy tree. It then reads individual pages with getConfluencePage to extract word counts and metadata. The tree reveals orphaned pages, shallow content, and structural gaps.',
  comment_activity_audit:
    'The agent audits review activity by calling getConfluencePageFooterComments and getConfluencePageInlineComments on every page. For comments with replies, getConfluenceCommentChildren surfaces threaded discussions. This reveals which pages have active review cycles and which are neglected.',
  knowledge_health_scoring:
    'Health scores are computed locally from data gathered in previous steps. Each page is scored on staleness (last modified date), depth (hierarchy position), comment activity (footer + inline counts), and word count. Scores identify stale, thin, or unreviewed documentation.',
  knowledge_actions:
    'Write operations add audit findings directly to Confluence. The agent posts audit summaries as footer comments (createConfluenceFooterComment), flags specific sections with inline comments (createConfluenceInlineComment), and can update page metadata (updateConfluencePage). Each write is policy-checked.',
  // Sprint operations
  sprint_context:
    'The agent calls getVisibleJiraProjects to list available projects, then getJiraProjectIssueTypesMetadata and getJiraIssueTypeMetaWithFields to understand the project\'s schema. This provides the field-level context needed for informed sprint operations.',
  issue_deep_dive:
    'In-progress issues are fetched via JQL, then enriched with getJiraIssue for full details, getJiraIssueRemoteIssueLinks for external references, and jiraRead(getIssueLinkTypes) for dependency mapping. This builds a complete picture of active sprint work.',
  team_resolution:
    'The agent calls lookupJiraAccountId to resolve team member names to account IDs. This is required before assigning issues or adding mentions \u2014 demonstrating how AI agents handle the name-to-ID resolution that humans do implicitly.',
  sprint_actions:
    'Sprint write operations include addWorklogToJiraIssue for time tracking, editJiraIssue for assignments, jiraWrite(createIssueLink) for cross-project dependencies, and addCommentToJiraIssue for sprint summaries. Each flows through the full security pipeline.',
  // Risk radar
  portfolio_discovery:
    'The agent calls getVisibleJiraProjects and getConfluenceSpaces to enumerate all accessible projects and spaces across the enterprise. atlassianUserInfo provides the authenticated user context. Each call flows through the gateway\'s full security pipeline.',
  compliance_scanning:
    'For each project and space, the agent runs searchJiraIssuesUsingJql and searchConfluenceUsingCql with compliance keywords (PHI, PII, HIPAA, SOC2, PCI, encryption). Each cross-project query flows individually through the gateway\'s injection scanner and audit log.',
  risk_heatmap:
    'Risk scores are computed locally from compliance scan results. Each project/space is scored across 4 dimensions: PII exposure, compliance documentation coverage, documentation freshness, and open security issues. The heatmap visualizes enterprise-wide compliance posture.',
  policy_recommendations:
    'Based on risk analysis, the system recommends which gateway policy templates to apply per project. For example, projects containing PHI patterns get PII Shield recommended, while regulated projects get Approval for Writes.',
};

export const HERO_COPY = {
  headline: 'See MCP in Action: Multiple Rovo Tools, One Security Gateway',
  subheadline:
    'Four enterprise workflows exercise 30 of 33 Atlassian Rovo MCP tools \u2014 reading Jira backlogs, auditing Confluence docs, managing sprints, and scanning compliance risks \u2014 all through an MCP Security Gateway. Plus interactive security and governance features you can explore hands-on.',
};

export const EXPLAINER_CARDS = [
  {
    title: 'What is MCP?',
    body: 'Model Context Protocol is Anthropic\'s open standard that lets Claude connect to external data sources and tools. Instead of copy-pasting context, Claude reads directly from Jira, databases, and APIs.',
  },
  {
    title: 'What This Demo Does',
    body: 'Four workflows exercise 30 Rovo MCP tools across Jira and Confluence \u2014 from deployment planning to compliance risk radar. Interactive security and governance features showcase the gateway\'s 5-scanner pipeline, 6 policy templates, and HITL approval engine.',
  },
  {
    title: 'Why It Matters',
    body: 'Enterprises need guardrails before connecting AI agents to production tools. The gateway provides injection scanning, policy enforcement, PII detection, and audit trails \u2014 so GSIs can deploy MCP safely from day one.',
  },
];

export const LIVE_INTEGRATION_COPY =
  'Live data flows through the MCP Security Gateway \u2192 Atlassian Rovo MCP Server \u2192 Jira Cloud + Confluence Cloud. 30 Rovo tools are used across reads, searches, and writes \u2014 each scanned for prompt injection, evaluated against policies, checked for PII, and logged to the audit trail.';

export interface ScenarioConfig {
  industry: Industry;
  title: string;
  description: string;
  projectKey: string;
  spaceKey?: string;
  spaceId?: string;
  tags: Array<{ label: string; color: string }>;
}

export const SCENARIOS: ScenarioConfig[] = [
  {
    industry: 'healthcare',
    title: 'Client Scenario: Regional Health Network',
    description:
      'A 12-hospital health system needs an AI-powered patient intake assistant integrated with their Epic EHR. The system must handle PHI and comply with HIPAA.',
    projectKey: process.env.NEXT_PUBLIC_DEMO_PROJECT_KEY_HEALTH ?? 'HEALTH',
    spaceKey: 'HA',
    spaceId: '1081348',
    tags: [
      { label: 'HIPAA', color: 'red' },
      { label: 'Epic EHR', color: 'blue' },
      { label: 'FHIR', color: 'purple' },
    ],
  },
  {
    industry: 'financial',
    title: 'Client Scenario: Regional Banking Group',
    description:
      'A mid-size bank wants to automate document processing for loan applications and provide AI-assisted customer service with SOC2 and PCI-DSS compliance.',
    projectKey: process.env.NEXT_PUBLIC_DEMO_PROJECT_KEY_FINSERV ?? 'FINSERV',
    spaceKey: 'FINS',
    spaceId: '1310728',
    tags: [
      { label: 'SOC2', color: 'amber' },
      { label: 'PCI-DSS', color: 'orange' },
    ],
  },
];

export const TAG_COLORS: Record<string, string> = {
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  amber: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  green: 'bg-green-100 text-green-700',
  gray: 'bg-gray-100 text-gray-600',
  teal: 'bg-teal-100 text-teal-700',
};
