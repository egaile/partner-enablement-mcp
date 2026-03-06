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

const MOCK_RESULTS: Record<string, SearchResult[]> = {
  HEALTH: [
    { type: 'jira', key: 'HEALTH-1', title: 'Patient Intake Conversational Flow', excerpt: 'Design and implement conversational AI flow for gathering patient information before appointments.', issueType: 'Epic', status: 'In Progress' },
    { type: 'jira', key: 'HEALTH-3', title: 'HIPAA Compliance Infrastructure', excerpt: 'Set up compliant infrastructure including encryption, audit logging, and access controls.', issueType: 'Epic', status: 'To Do' },
    { type: 'confluence', title: 'HIPAA Architecture Guide', excerpt: 'Reference architecture for HIPAA-compliant AI deployments including PHI handling, encryption at rest, and audit requirements.', spaceKey: 'ARCH' },
    { type: 'confluence', title: 'PHI Data Handling Procedures', excerpt: 'Standard operating procedures for Protected Health Information in AI/ML pipelines.', spaceKey: 'SEC' },
  ],
  FINSERV: [
    { type: 'jira', key: 'FINSERV-1', title: 'Loan Document Processing Pipeline', excerpt: 'Implement AI-powered document extraction and classification for loan applications.', issueType: 'Epic', status: 'In Progress' },
    { type: 'jira', key: 'FINSERV-3', title: 'SOC2 Compliance Automation', excerpt: 'Automate SOC2 evidence collection and continuous monitoring.', issueType: 'Task', status: 'To Do' },
    { type: 'confluence', title: 'SOC2 Control Matrix', excerpt: 'Complete mapping of SOC2 Type II controls to our AI infrastructure, including continuous monitoring requirements.', spaceKey: 'COMP' },
    { type: 'confluence', title: 'PCI-DSS Tokenization Architecture', excerpt: 'Reference architecture for tokenizing payment card data before AI processing.', spaceKey: 'ARCH' },
  ],
};

/**
 * Parse Rovo search results — may be JSON or markdown.
 */
function parseRovoResults(text: string, projectKey: string): SearchResult[] {
  // Try JSON first
  try {
    const data = JSON.parse(text);
    const results: SearchResult[] = [];

    // Handle array of results
    const items = Array.isArray(data) ? data : data?.results ?? data?.issues ?? [];
    for (const item of items) {
      if (item.key || item.issueKey) {
        results.push({
          type: 'jira',
          key: item.key ?? item.issueKey ?? '',
          title: item.title ?? item.summary ?? item.fields?.summary ?? '',
          excerpt: (item.excerpt ?? item.description ?? item.fields?.description ?? '').slice(0, 200),
          issueType: item.issueType ?? item.fields?.issuetype?.name ?? 'Task',
          status: item.status ?? item.fields?.status?.name ?? 'Unknown',
        });
      } else if (item.spaceKey || item.type === 'page' || item.contentType === 'page') {
        results.push({
          type: 'confluence',
          title: item.title ?? '',
          excerpt: (item.excerpt ?? item.description ?? item.content ?? '').slice(0, 200),
          spaceKey: item.spaceKey ?? item.space?.key ?? '',
          url: item.url ?? item.href ?? '',
        });
      }
    }

    if (results.length > 0) return results;
  } catch {
    // Not JSON — try to extract from markdown/text
  }

  // Parse markdown-formatted results (Rovo sometimes returns markdown)
  const lines = text.split('\n');
  const results: SearchResult[] = [];
  for (const line of lines) {
    // Match patterns like "- [HEALTH-1] Patient Intake..." or "- HEALTH-1: Patient Intake..."
    const jiraMatch = line.match(/[-*]\s*\[?([A-Z]+-\d+)\]?\s*[:\-—]\s*(.+)/);
    if (jiraMatch) {
      results.push({
        type: 'jira',
        key: jiraMatch[1],
        title: jiraMatch[2].trim(),
        excerpt: jiraMatch[2].trim(),
        issueType: 'Task',
        status: 'Unknown',
      });
      continue;
    }
    // Match Confluence page patterns
    const confMatch = line.match(/[-*]\s*\[([^\]]+)\]\(([^)]+)\)/);
    if (confMatch && !confMatch[1].match(/^[A-Z]+-\d+$/)) {
      results.push({
        type: 'confluence',
        title: confMatch[1],
        excerpt: confMatch[1],
        url: confMatch[2],
      });
    }
  }

  return results;
}

/**
 * Fetch via Rovo search (cross-product: Jira + Confluence in one call).
 * Falls back to JQL-only if Rovo search fails.
 */
async function fetchViaGateway(projectKey: string): Promise<SearchResult[]> {
  // Step 1: Get cloudId via Rovo
  const resourcesResult = await callTool(rovo('getAccessibleAtlassianResources'), {});
  if (resourcesResult.isError) throw new Error(`Tool error: ${extractText(resourcesResult)}`);
  const resources = JSON.parse(extractText(resourcesResult));
  const cloudId: string = Array.isArray(resources) ? resources[0]?.id : resources?.id;
  if (!cloudId) throw new Error('No Atlassian cloud resources found');

  // Step 2: Try Rovo cross-product search first
  try {
    const searchResult = await callTool(rovo('search'), {
      query: `project ${projectKey} AI deployment architecture compliance`,
    });

    if (!searchResult.isError) {
      const text = extractText(searchResult);
      const results = parseRovoResults(text, projectKey);
      if (results.length > 0) return results;
    }
  } catch (err) {
    console.warn('[cross-product-search] Rovo search failed, falling back to JQL:', err instanceof Error ? err.message : err);
  }

  // Step 3: Fallback — search Jira via JQL
  const jqlResult = await callTool(rovo('searchJiraIssuesUsingJql'), {
    cloudId,
    jql: `project = ${projectKey} ORDER BY created DESC`,
    maxResults: 8,
    fields: ['summary', 'description', 'status', 'issuetype', 'priority'],
  });

  const results: SearchResult[] = [];
  if (!jqlResult.isError) {
    const text = extractText(jqlResult);
    try {
      const data = JSON.parse(text);
      const issues = Array.isArray(data?.issues) ? data.issues : [];
      for (const issue of issues) {
        const fields = issue.fields ?? {};
        results.push({
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

  return results;
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
        results = MOCK_RESULTS[projectKey] ?? MOCK_RESULTS['HEALTH'];
        source = 'mock';
      }
    } else {
      results = MOCK_RESULTS[projectKey] ?? MOCK_RESULTS['HEALTH'];
      source = 'mock';
    }

    const response: SearchResponse = { results, source };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
