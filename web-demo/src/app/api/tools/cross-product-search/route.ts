import { NextResponse } from 'next/server';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ROVO_SERVER_NAME } from '../_shared';
import { rateLimit } from '../_rateLimit';

function rovo(toolName: string): string {
  return `${ROVO_SERVER_NAME}__${toolName}`;
}

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

export interface SearchResult {
  type: 'jira' | 'confluence';
  key?: string;
  title: string;
  excerpt: string;
  url?: string;
  issueType?: string;
  status?: string;
  spaceKey?: string;
}

interface SearchResponse {
  results: SearchResult[];
  source: 'gateway' | 'mock';
}

/**
 * Confluence results are supplementary — no Confluence search tool is registered
 * on the Rovo MCP server, so we show curated docs per industry vertical.
 */
const CONFLUENCE_DOCS: Record<string, SearchResult[]> = {
  HEALTH: [
    { type: 'confluence', title: 'HIPAA Architecture Guide', excerpt: 'Reference architecture for HIPAA-compliant AI deployments including PHI handling, encryption at rest, and audit requirements.', spaceKey: 'ARCH' },
    { type: 'confluence', title: 'PHI Data Handling Procedures', excerpt: 'Standard operating procedures for Protected Health Information in AI/ML pipelines, covering de-identification and minimum necessary access.', spaceKey: 'SEC' },
    { type: 'confluence', title: 'Epic EHR Integration Patterns', excerpt: 'Technical guide for integrating Claude-powered assistants with Epic FHIR APIs, including authentication flows and data mapping.', spaceKey: 'INT' },
  ],
  FINSERV: [
    { type: 'confluence', title: 'SOC2 Control Matrix', excerpt: 'Complete mapping of SOC2 Type II controls to our AI infrastructure, including continuous monitoring requirements and evidence collection.', spaceKey: 'COMP' },
    { type: 'confluence', title: 'PCI-DSS Tokenization Architecture', excerpt: 'Reference architecture for tokenizing payment card data before AI processing, ensuring no PAN data reaches LLM context.', spaceKey: 'ARCH' },
    { type: 'confluence', title: 'KYC Automation Playbook', excerpt: 'Step-by-step guide for implementing AI-assisted Know Your Customer verification with regulatory compliance checkpoints.', spaceKey: 'OPS' },
  ],
};

const MOCK_JIRA_RESULTS: Record<string, SearchResult[]> = {
  HEALTH: [
    { type: 'jira', key: 'HEALTH-1', title: 'Patient Intake Conversational Flow', excerpt: 'Design and implement conversational AI flow for gathering patient information before appointments.', issueType: 'Epic', status: 'In Progress' },
    { type: 'jira', key: 'HEALTH-3', title: 'HIPAA Compliance Infrastructure', excerpt: 'Set up compliant infrastructure including encryption, audit logging, and access controls.', issueType: 'Epic', status: 'To Do' },
  ],
  FINSERV: [
    { type: 'jira', key: 'FINSERV-1', title: 'Loan Document Processing Pipeline', excerpt: 'Implement AI-powered document extraction and classification for loan applications.', issueType: 'Epic', status: 'In Progress' },
    { type: 'jira', key: 'FINSERV-3', title: 'SOC2 Compliance Automation', excerpt: 'Automate SOC2 evidence collection and continuous monitoring.', issueType: 'Task', status: 'To Do' },
  ],
};

async function fetchViaGateway(projectKey: string): Promise<SearchResult[]> {
  // Step 1: Get cloudId via Rovo
  const resourcesResult = await callTool(rovo('getAccessibleAtlassianResources'), {});
  if (resourcesResult.isError) throw new Error(`Tool error: ${extractText(resourcesResult)}`);
  const resources = JSON.parse(extractText(resourcesResult));
  const cloudId: string = Array.isArray(resources) ? resources[0]?.id : resources?.id;
  if (!cloudId) throw new Error('No Atlassian cloud resources found');

  // Step 2: Search Jira issues via JQL (the only reliable search tool on Rovo)
  const jqlResult = await callTool(rovo('searchJiraIssuesUsingJql'), {
    cloudId,
    jql: `project = ${projectKey} ORDER BY created DESC`,
    maxResults: 8,
    fields: ['summary', 'description', 'status', 'issuetype', 'priority'],
  });

  const jiraResults: SearchResult[] = [];
  if (!jqlResult.isError) {
    const text = extractText(jqlResult);
    try {
      const data = JSON.parse(text);
      const issues = Array.isArray(data?.issues) ? data.issues : [];
      for (const issue of issues) {
        const fields = issue.fields ?? {};
        jiraResults.push({
          type: 'jira',
          key: issue.key ?? '',
          title: fields.summary ?? '',
          excerpt: typeof fields.description === 'string'
            ? fields.description.slice(0, 200)
            : '',
          issueType: fields.issuetype?.name ?? 'Task',
          status: fields.status?.name ?? 'Unknown',
        });
      }
    } catch {
      console.warn('[cross-product-search] Failed to parse JQL response');
    }
  }

  // Supplement with Confluence docs (no Confluence search tool available on Rovo)
  const confluenceDocs = CONFLUENCE_DOCS[projectKey] ?? CONFLUENCE_DOCS['HEALTH'];

  return [...jiraResults, ...confluenceDocs];
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const projectKey = (body.projectKey as string) ?? 'HEALTH';

    let results: SearchResult[];
    let source: 'gateway' | 'mock';

    if (isConfigured()) {
      try {
        results = await fetchViaGateway(projectKey);
        source = 'gateway';
      } catch (err) {
        console.warn('[cross-product-search] Gateway failed, using mock:', err instanceof Error ? err.message : err);
        resetSession();
        const mockJira = MOCK_JIRA_RESULTS[projectKey] ?? MOCK_JIRA_RESULTS['HEALTH'];
        const mockConfluence = CONFLUENCE_DOCS[projectKey] ?? CONFLUENCE_DOCS['HEALTH'];
        results = [...mockJira, ...mockConfluence];
        source = 'mock';
      }
    } else {
      const mockJira = MOCK_JIRA_RESULTS[projectKey] ?? MOCK_JIRA_RESULTS['HEALTH'];
      const mockConfluence = CONFLUENCE_DOCS[projectKey] ?? CONFLUENCE_DOCS['HEALTH'];
      results = [...mockJira, ...mockConfluence];
      source = 'mock';
    }

    const response: SearchResponse = { results, source };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
