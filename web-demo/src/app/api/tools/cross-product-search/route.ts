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
    { type: 'confluence', title: 'HIPAA Architecture Guide', excerpt: 'Reference architecture for HIPAA-compliant AI deployments including PHI handling, encryption at rest, and audit requirements.', spaceKey: 'ARCH' },
    { type: 'confluence', title: 'PHI Data Handling Procedures', excerpt: 'Standard operating procedures for Protected Health Information in AI/ML pipelines, covering de-identification and minimum necessary access.', spaceKey: 'SEC' },
    { type: 'confluence', title: 'Epic EHR Integration Patterns', excerpt: 'Technical guide for integrating Claude-powered assistants with Epic FHIR APIs, including authentication flows and data mapping.', spaceKey: 'INT' },
    { type: 'jira', key: 'INFRA-142', title: 'Deploy HIPAA-compliant logging infrastructure', excerpt: 'Set up encrypted audit logging for all PHI access events with 7-year retention.', issueType: 'Task', status: 'In Progress' },
    { type: 'jira', key: 'SEC-88', title: 'Quarterly PHI access review automation', excerpt: 'Automate the quarterly review of PHI access logs using Claude for anomaly detection.', issueType: 'Story', status: 'To Do' },
  ],
  FINSERV: [
    { type: 'confluence', title: 'SOC2 Control Matrix', excerpt: 'Complete mapping of SOC2 Type II controls to our AI infrastructure, including continuous monitoring requirements and evidence collection.', spaceKey: 'COMP' },
    { type: 'confluence', title: 'PCI-DSS Tokenization Architecture', excerpt: 'Reference architecture for tokenizing payment card data before AI processing, ensuring no PAN data reaches LLM context.', spaceKey: 'ARCH' },
    { type: 'confluence', title: 'KYC Automation Playbook', excerpt: 'Step-by-step guide for implementing AI-assisted Know Your Customer verification with regulatory compliance checkpoints.', spaceKey: 'OPS' },
    { type: 'jira', key: 'RISK-201', title: 'Implement real-time fraud detection model', excerpt: 'Deploy Claude-powered transaction monitoring for suspicious activity pattern detection.', issueType: 'Epic', status: 'In Progress' },
    { type: 'jira', key: 'COMP-77', title: 'Annual PCI-DSS recertification prep', excerpt: 'Prepare documentation and evidence for annual PCI-DSS Level 1 service provider recertification.', issueType: 'Task', status: 'To Do' },
  ],
};

async function fetchViaGateway(projectKey: string, query: string): Promise<SearchResult[]> {
  const searchResult = await callTool(rovo('search'), { query });
  if (searchResult.isError) {
    throw new Error(`Search error: ${extractText(searchResult)}`);
  }
  const text = extractText(searchResult);
  const data = JSON.parse(text);

  // Parse Rovo search results into our format
  const results: SearchResult[] = [];
  const items = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];

  for (const item of items.slice(0, 8)) {
    const id = (item.id as string) ?? '';
    const title = (item.title as string) ?? (item.name as string) ?? '';
    const excerpt = (item.excerpt as string) ?? (item.description as string) ?? (item.content as string)?.slice(0, 200) ?? '';
    const url = (item.url as string) ?? (item.href as string) ?? '';

    if (id.includes('issue') || id.includes('jira') || item.type === 'issue') {
      results.push({
        type: 'jira',
        key: (item.key as string) ?? title.split(' ')[0],
        title,
        excerpt: excerpt.slice(0, 200),
        url,
        issueType: (item.issueType as string) ?? 'Task',
        status: (item.status as string) ?? 'Unknown',
      });
    } else {
      results.push({
        type: 'confluence',
        title,
        excerpt: excerpt.slice(0, 200),
        url,
        spaceKey: (item.spaceKey as string) ?? (item.space as string) ?? '',
      });
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
    const searchQuery = (body.query as string) ?? `${projectKey} architecture compliance deployment`;

    let results: SearchResult[];
    let source: 'gateway' | 'mock';

    if (isConfigured()) {
      try {
        results = await fetchViaGateway(projectKey, searchQuery);
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
