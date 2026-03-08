import type { Step, Industry } from '@/types/api';

export const STEP_DEFINITIONS: Array<{
  key: Exclude<Step, 'select' | 'complete'>;
  label: string;
  toolName: string;
  toolDescription: string;
}> = [
  {
    key: 'context',
    label: 'Project Context',
    toolName: 'read_project_context',
    toolDescription: 'Read and analyze Jira project backlog',
  },
  {
    key: 'search',
    label: 'Cross-Product Search',
    toolName: 'cross_product_search',
    toolDescription: 'Search across Jira and Confluence',
  },
  {
    key: 'health',
    label: 'Project Health',
    toolName: 'project_health',
    toolDescription: 'Assess project readiness from issue data',
  },
  {
    key: 'architecture',
    label: 'Architecture',
    toolName: 'generate_architecture',
    toolDescription: 'Generate architecture with Confluence context',
  },
  {
    key: 'compliance',
    label: 'Compliance',
    toolName: 'assess_compliance',
    toolDescription: 'Assess compliance with doc coverage audit',
  },
  {
    key: 'plan',
    label: 'Implementation',
    toolName: 'create_implementation_plan',
    toolDescription: 'Create phased implementation plan',
  },
  {
    key: 'actions',
    label: 'Agent Actions',
    toolName: 'agent_actions',
    toolDescription: 'Execute write operations via Rovo tools',
  },
];

export const TOOL_NARRATIVES: Record<string, string> = {
  read_project_context:
    'This call flows through the MCP Security Gateway to the Atlassian Rovo MCP Server, which reads the project backlog from Jira Cloud in real time. Every request passes through the gateway\'s security pipeline \u2014 prompt injection scanning, policy enforcement, PII detection, and audit logging \u2014 before reaching Jira. The response is analyzed for compliance indicators, integration targets, and data classifications.',
  cross_product_search:
    'The gateway proxies a Rovo Search call through the Atlassian Rovo MCP Server, searching across both Jira and Confluence in a single query. Each request passes through injection scanning, policy evaluation, and audit logging. If Rovo Search is unavailable, the gateway falls back to JQL-based Jira search.',
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
};

export const HERO_COPY = {
  headline: 'See MCP in Action: Multiple Rovo Tools, One Security Gateway',
  subheadline:
    'This demo uses multiple Atlassian Rovo MCP tools to read Jira backlogs, search Confluence docs via CQL, assess compliance coverage, generate architecture plans, and execute write operations \u2014 all through an MCP Security Gateway with injection scanning, policy enforcement, PII detection, and a live audit trail.',
};

export const EXPLAINER_CARDS = [
  {
    title: 'What is MCP?',
    body: 'Model Context Protocol is Anthropic\'s open standard that lets Claude connect to external data sources and tools. Instead of copy-pasting context, Claude reads directly from Jira, databases, and APIs.',
  },
  {
    title: 'What This Demo Does',
    body: 'This demo exercises multiple Rovo MCP tools across Jira and Confluence \u2014 reading project backlogs, searching docs via CQL, assessing compliance coverage, and executing write operations like labeling issues and creating pages. Every call flows through the MCP Security Gateway with a live audit trail.',
  },
  {
    title: 'Why It Matters',
    body: 'Enterprises need guardrails before connecting AI agents to production tools. The gateway provides injection scanning, policy enforcement, PII detection, and audit trails \u2014 so GSIs can deploy MCP safely from day one.',
  },
];

export const LIVE_INTEGRATION_COPY =
  'Live data flows through the MCP Security Gateway \u2192 Atlassian Rovo MCP Server \u2192 Jira Cloud + Confluence Cloud. Multiple Rovo tools are used across reads, searches, and writes \u2014 each scanned for prompt injection, evaluated against policies, checked for PII, and logged to the audit trail.';

export interface ScenarioConfig {
  industry: Industry;
  title: string;
  description: string;
  projectKey: string;
  tags: Array<{ label: string; color: string }>;
}

export const SCENARIOS: ScenarioConfig[] = [
  {
    industry: 'healthcare',
    title: 'Client Scenario: Regional Health Network',
    description:
      'A 12-hospital health system needs an AI-powered patient intake assistant integrated with their Epic EHR. The system must handle PHI and comply with HIPAA.',
    projectKey: process.env.NEXT_PUBLIC_DEMO_PROJECT_KEY_HEALTH ?? 'HEALTH',
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
};
