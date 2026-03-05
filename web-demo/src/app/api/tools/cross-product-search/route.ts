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

  // Log raw response for debugging (first 500 chars)
  console.log('[cross-product-search] Raw Rovo search response:', text.slice(0, 500));

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Rovo search may return plain text / markdown instead of JSON
    console.warn('[cross-product-search] Non-JSON response, returning as single result');
    return [{
      type: 'confluence',
      title: `Search results for "${query}"`,
      excerpt: text.slice(0, 300),
    }];
  }

  // Parse Rovo search results — the response format varies:
  // - Array of result objects directly
  // - { results: [...] } wrapper
  // - { data: [...] } wrapper
  const results: SearchResult[] = [];
  const raw = data as Record<string, unknown>;
  const items: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray(raw?.results) ? raw.results as Record<string, unknown>[]
    : Array.isArray(raw?.data) ? raw.data as Record<string, unknown>[]
    : [];

  console.log(`[cross-product-search] Parsed ${items.length} items`);
  if (items.length > 0) {
    console.log('[cross-product-search] First item keys:', Object.keys(items[0]));
  }

  for (const item of items.slice(0, 8)) {
    // Rovo search returns ARIs like "ari:cloud:jira:..." or "ari:cloud:confluence:..."
    const id = String(item.id ?? item.ari ?? '');
    const title = String(item.title ?? item.name ?? '');
    const excerpt = String(
      item.excerpt ?? item.description ?? item.snippet ?? item.content ?? ''
    ).slice(0, 200);
    const url = String(item.url ?? item.href ?? item.link ?? '');

    const isJira = id.includes('jira') || id.includes('issue')
      || url.includes('/browse/') || url.includes('jira')
      || String(item.type ?? '').toLowerCase().includes('issue');
    const isConfluence = id.includes('confluence') || id.includes('page')
      || url.includes('/wiki/') || url.includes('confluence');

    if (isJira) {
      // Try to extract issue key from URL or title (e.g. "HEALTH-123")
      const keyMatch = (url.match(/\/browse\/([A-Z]+-\d+)/) ?? title.match(/^([A-Z]+-\d+)/));
      results.push({
        type: 'jira',
        key: (item.key as string) ?? keyMatch?.[1] ?? '',
        title,
        excerpt,
        url,
        issueType: String(item.issueType ?? item.type ?? 'Task'),
        status: String(item.status ?? 'Unknown'),
      });
    } else {
      // Default to confluence for pages/docs or anything non-Jira
      results.push({
        type: isConfluence ? 'confluence' : 'confluence',
        title,
        excerpt,
        url,
        spaceKey: String(item.spaceKey ?? item.space ?? item.container ?? ''),
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
