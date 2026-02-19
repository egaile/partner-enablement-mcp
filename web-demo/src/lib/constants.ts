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
    key: 'architecture',
    label: 'Architecture',
    toolName: 'generate_architecture',
    toolDescription: 'Generate cloud-native reference architecture',
  },
  {
    key: 'compliance',
    label: 'Compliance',
    toolName: 'assess_compliance',
    toolDescription: 'Assess regulatory compliance requirements',
  },
  {
    key: 'plan',
    label: 'Implementation',
    toolName: 'create_implementation_plan',
    toolDescription: 'Create phased implementation plan',
  },
];

export const TOOL_NARRATIVES: Record<string, string> = {
  read_project_context:
    'The MCP server connects to Jira Cloud (genxcelerator.atlassian.net) via REST API v3 and reads the project backlog in real time. It analyzes labels to detect compliance requirements, scans descriptions to identify integration targets, and classifies data types. Claude receives this exact structured data when it calls this tool.',
  generate_architecture:
    'Using the project context, the MCP server\'s knowledge base recommends an architecture pattern. It matches against four pre-built patterns, then generates a cloud-native component breakdown with specific AWS services and Anthropic API integration points.',
  assess_compliance:
    'The MCP server cross-references detected compliance tags against its knowledge base of regulatory frameworks. It identifies applicable frameworks, generates detailed requirements, flags risk areas specific to LLM deployments, and produces an implementation checklist.',
  create_implementation_plan:
    'The MCP server generates a phased implementation plan calibrated to the architecture pattern\'s complexity. It creates sprint-level timelines, identifies required skills, estimates effort, and generates Jira ticket templates ready for import.',
};

export const HERO_COPY = {
  headline: 'See MCP in Action: From Jira Backlog to Deployment-Ready Architecture',
  subheadline:
    'This demo shows how an MCP (Model Context Protocol) server gives Claude real-time access to enterprise tools. It reads project context from a live Jira Cloud instance, then generates compliant reference architectures, compliance assessments, and implementation plans.',
};

export const EXPLAINER_CARDS = [
  {
    title: 'What is MCP?',
    body: 'Model Context Protocol is Anthropic\'s open standard that lets Claude connect to external data sources and tools. Instead of copy-pasting context, Claude reads directly from Jira, databases, and APIs.',
  },
  {
    title: 'What This Demo Does',
    body: 'Four MCP tools work in sequence: read project context from Jira, generate a cloud-native architecture, assess regulatory compliance, and create a phased implementation plan.',
  },
  {
    title: 'Why It Matters',
    body: 'GSIs spend weeks doing this manually for each client engagement. An MCP-powered workflow compresses this to minutes while ensuring compliance requirements are captured from day one.',
  },
];

export const LIVE_INTEGRATION_COPY =
  'This demo is connected to a live Jira Cloud instance (genxcelerator.atlassian.net) with real projects and issues. All data you see is fetched in real-time via MCP tools.';

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
    projectKey: 'HEALTH',
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
    projectKey: 'FINSERV',
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
