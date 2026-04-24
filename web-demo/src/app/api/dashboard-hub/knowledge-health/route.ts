import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { callTool, isConfigured } from '@/lib/gateway-client';
import { ATLASSIAN_CLOUD_ID, rovo, extractText, safeJsonParse } from '@/app/api/tools/_shared';
import type { PageInfo, CommentInfo } from '@/types/api';
import { buildChildrenIndex, computeScores } from '@/lib/health-scoring';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PAGES = 12;
const PAGE_DETAIL_CONCURRENCY = 3;
const TOKEN = process.env.DASHBOARD_HUB_API_TOKEN ?? '';
// Set DASHBOARD_HUB_PUBLIC=true on Vercel to bypass Bearer auth — useful when
// connecting Dashboard Hub Pro for the first time. Always restore once the
// integration is working.
const PUBLIC_MODE = process.env.DASHBOARD_HUB_PUBLIC === 'true';

type HealthStatus = 'healthy' | 'needs-attention' | 'stale' | 'critical';

interface FlatPage {
  pageId: string;
  title: string;
  score: number;
  status: HealthStatus;
  statusColor: string;
  statusEmoji: string;
  staleness: number;
  depth: number;
  commentActivity: number;
  wordCount: number;
  topRecommendation: string | null;
}

const STATUS_COLOR_MAP: Record<HealthStatus, string> = {
  healthy: '#22C55E',
  'needs-attention': '#F59E0B',
  stale: '#F97316',
  critical: '#EF4444',
};

const STATUS_EMOJI_MAP: Record<HealthStatus, string> = {
  healthy: '🟢',
  'needs-attention': '🟡',
  stale: '🟠',
  critical: '🔴',
};

interface SliceEntry {
  name: string;
  value: number;
  color: string;
}

interface DashboardHealthPayload {
  generatedAt: string;
  space: { key: string; name: string };
  // Pre-shaped arrays for chart consumption — Dashboard Hub Pro's piechart
  // node treats `data[]` as static config and won't evaluate templates inside,
  // so we have to land the data in array form already.
  statusBreakdown: SliceEntry[];
  summary: {
    averageScore: number;
    totalPages: number;
    healthyCount: number;
    needsAttentionCount: number;
    staleCount: number;
    criticalCount: number;
  };
  pages: FlatPage[];
  source: 'gateway' | 'mock';
}

function authorized(req: Request): boolean {
  if (!TOKEN) return false;
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const presented = match[1];
  const a = Buffer.from(presented);
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized. Provide Authorization: Bearer <DASHBOARD_HUB_API_TOKEN>.' },
    { status: 401 }
  );
}

function countWords(body: unknown): number {
  const text = typeof body === 'string'
    ? body
    : (body as Record<string, unknown>)?.storage
      ? ((body as { storage: { value: string } }).storage.value ?? '')
      : (body as Record<string, unknown>)?.view
        ? ((body as { view: { value: string } }).view.value ?? '')
        : '';
  return (text as string).split(/\s+/).filter(Boolean).length;
}

async function fetchViaGateway(spaceKey: string): Promise<DashboardHealthPayload> {
  // Use the per-call session wrapper. Reusing one session across many calls
  // races on init under concurrency and the gateway returns "Server not
  // initialized". Per-call sessions match the working pattern in /api/tools/*.
  const call = async (name: string, args: Record<string, unknown>) => {
    try {
      return await callTool(name, args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[step:${name}] ${msg}`);
    }
  };

  // 1) Find space
  console.log(`[dashboard-hub] Step 1: getConfluenceSpaces (spaceKey=${spaceKey})`);
  const spacesResult = await call(rovo('getConfluenceSpaces'), {
    cloudId: ATLASSIAN_CLOUD_ID,
  });
  if (spacesResult.isError) {
    throw new Error(`getConfluenceSpaces returned isError: ${extractText(spacesResult)}`);
  }
  const spacesData = safeJsonParse(extractText(spacesResult)) as Record<string, unknown> | null;
  const spaces = (spacesData?.results ?? spacesData ?? []) as Array<Record<string, unknown>>;
  const space = spaces.find((s) => s.key === spaceKey);
  if (!space) {
    throw new Error(`Space with key "${spaceKey}" not found`);
  }
  const spaceId = String(space.id);
  const spaceName = (space.name as string) ?? spaceKey;

  // 2) List pages
  const pagesResult = await call(rovo('getPagesInConfluenceSpace'), {
    cloudId: ATLASSIAN_CLOUD_ID,
    spaceId,
    limit: MAX_PAGES,
    sort: '-modified-date',
  });
  if (pagesResult.isError) {
    throw new Error(`getPagesInConfluenceSpace: ${extractText(pagesResult)}`);
  }
  const pagesData = safeJsonParse(extractText(pagesResult)) as Record<string, unknown> | null;
  const rawPages = (pagesData?.results ?? pagesData ?? []) as Array<Record<string, unknown>>;

  const pages: PageInfo[] = rawPages.slice(0, MAX_PAGES).map((p) => ({
    id: String(p.id ?? ''),
    title: (p.title as string) ?? '',
    spaceId,
    parentId: p.parentId ? String(p.parentId) : undefined,
    status: (p.status as string) ?? 'current',
    lastModified: (p.lastModifiedDate as string) ?? (p.modifiedAt as string) ?? undefined,
    authorName: ((p.author as Record<string, unknown>)?.displayName as string) ?? undefined,
    version: typeof p.version === 'object'
      ? ((p.version as Record<string, unknown>)?.number as number) ?? undefined
      : (p.version as number) ?? undefined,
  }));

  if (pages.length === 0) {
    throw new Error(`Space "${spaceKey}" has no pages`);
  }

  // 3) Hydrate body/word-count + refresh lastModified per page
  // Bounded concurrency — full Promise.all of 25 fanouts overwhelmed the gateway.
  const pageDetails: Record<string, { wordCount: number; lastModified?: string }> = {};
  const hydrate = async (page: PageInfo) => {
    try {
      const pageResult = await call(rovo('getConfluencePage'), {
        cloudId: ATLASSIAN_CLOUD_ID,
        pageId: page.id,
        contentFormat: 'markdown',
      });
      if (pageResult.isError) {
        pageDetails[page.id] = { wordCount: 0, lastModified: page.lastModified };
        return;
      }
      const pageData = safeJsonParse(extractText(pageResult)) as Record<string, unknown> | null;
      const wordCount = countWords(pageData?.body);
      const lastMod = ((pageData?.version as Record<string, unknown>)?.when as string)
        ?? ((pageData?.version as Record<string, unknown>)?.createdAt as string)
        ?? (pageData?.lastModifiedDate as string)
        ?? page.lastModified;
      pageDetails[page.id] = { wordCount, lastModified: lastMod };
      page.wordCount = wordCount;
      page.lastModified = lastMod;
      page.depth = page.parentId ? 1 : 0;
    } catch {
      pageDetails[page.id] = { wordCount: 0, lastModified: page.lastModified };
    }
  };

  for (let i = 0; i < pages.length; i += PAGE_DETAIL_CONCURRENCY) {
    await Promise.all(pages.slice(i, i + PAGE_DETAIL_CONCURRENCY).map(hydrate));
  }

  // 4) Comments via CQL
  const footerComments: CommentInfo[] = [];
  const inlineComments: CommentInfo[] = [];
  const idList = pages.map((p) => p.id).join(',');
  if (idList) {
    try {
      const commentsResult = await call(rovo('searchConfluenceUsingCql'), {
        cloudId: ATLASSIAN_CLOUD_ID,
        cql: `type = comment AND container IN (${idList})`,
        limit: 200,
      });
      if (!commentsResult.isError) {
        const commentsData = safeJsonParse(extractText(commentsResult)) as Record<string, unknown> | null;
        const results = (commentsData?.results ?? []) as Array<Record<string, unknown>>;
        const titleMap = new Map(pages.map((p) => [p.id, p.title]));
        for (const raw of results) {
          const content = raw.content as Record<string, unknown> | undefined;
          const expandable = content?._expandable as Record<string, unknown> | undefined;
          const containerPath = (expandable?.container as string) ?? '';
          const pageId = containerPath.split('/').pop() ?? '';
          const extensions = content?.extensions as Record<string, unknown> | undefined;
          const location = (extensions?.location as string) ?? 'footer';
          const history = content?.history as Record<string, unknown> | undefined;
          const createdBy = history?.createdBy as Record<string, unknown> | undefined;
          const entry: CommentInfo = {
            id: String(content?.id ?? raw.id ?? ''),
            pageId,
            pageTitle: titleMap.get(pageId) ?? '',
            author: (createdBy?.displayName as string) ?? 'Unknown',
            body: '',
            created: (history?.createdDate as string) ?? '',
            type: location === 'inline' ? 'inline' : 'footer',
          };
          if (entry.type === 'inline') inlineComments.push(entry);
          else footerComments.push(entry);
        }
      }
    } catch {
      // Treat comment fetch failure as zero comments rather than failing the whole request.
    }
  }

  // 5) Score
  const childrenOf = buildChildrenIndex(pages);
  const scored = computeScores(pages, { footerComments, inlineComments }, pageDetails, childrenOf);

  return {
    generatedAt: new Date().toISOString(),
    space: { key: spaceKey, name: spaceName },
    statusBreakdown: buildStatusBreakdown(scored),
    summary: {
      averageScore: scored.averageScore,
      totalPages: scored.pageScores.length,
      healthyCount: scored.healthyCount,
      needsAttentionCount: scored.needsAttentionCount,
      staleCount: scored.staleCount,
      criticalCount: scored.criticalCount,
    },
    pages: scored.pageScores.map((p) => ({
      pageId: p.pageId,
      title: p.title,
      score: p.score,
      status: p.status,
      statusColor: STATUS_COLOR_MAP[p.status as HealthStatus] ?? '#9CA3AF',
      statusEmoji: STATUS_EMOJI_MAP[p.status as HealthStatus] ?? '⚪',
      staleness: p.factors.staleness,
      depth: p.factors.depth,
      commentActivity: p.factors.commentActivity,
      wordCount: p.factors.wordCount,
      topRecommendation: p.recommendations[0] ?? null,
    })),
    source: 'gateway',
  };
}

function buildStatusBreakdown(scored: { healthyCount: number; needsAttentionCount: number; staleCount: number; criticalCount: number }): SliceEntry[] {
  return [
    { name: 'Healthy',         value: scored.healthyCount,         color: '#22C55E' },
    { name: 'Needs Attention', value: scored.needsAttentionCount, color: '#F59E0B' },
    { name: 'Stale',           value: scored.staleCount,          color: '#F97316' },
    { name: 'Critical',        value: scored.criticalCount,       color: '#EF4444' },
  ];
}

function getMockPayload(spaceKey: string): DashboardHealthPayload {
  const spaceName = spaceKey === 'HA' ? 'Healthcare AI' : spaceKey === 'FINS' ? 'Financial Services' : spaceKey;

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 24 * 3600 * 1000).toISOString();

  const pages: PageInfo[] = [
    { id: 'mk-001', title: 'Healthcare AI Homepage',            spaceId: 'mock', status: 'current', lastModified: daysAgo(43), depth: 0, wordCount: 450 },
    { id: 'mk-002', title: 'AI Assistant Requirements',          spaceId: 'mock', parentId: 'mk-001', status: 'current', lastModified: daysAgo(45), depth: 1, wordCount: 1200 },
    { id: 'mk-003', title: 'Healthcare AI Reference Architecture', spaceId: 'mock', parentId: 'mk-001', status: 'current', lastModified: daysAgo(53), depth: 1, wordCount: 2800 },
    { id: 'mk-004', title: 'EHR Integration Specifications',     spaceId: 'mock', parentId: 'mk-003', status: 'current', lastModified: daysAgo(61), depth: 2, wordCount: 15 },
    { id: 'mk-005', title: 'AI Model Deployment Checklist',      spaceId: 'mock', parentId: 'mk-003', status: 'current', lastModified: daysAgo(97), depth: 2, wordCount: 650 },
    { id: 'mk-006', title: 'HIPAA Compliance Policy',            spaceId: 'mock', parentId: 'mk-001', status: 'current', lastModified: daysAgo(41), depth: 1, wordCount: 3 },
    { id: 'mk-007', title: 'PHI Data Classification Guide',      spaceId: 'mock', parentId: 'mk-001', status: 'current', lastModified: daysAgo(72), depth: 1, wordCount: 1800 },
  ];

  const pageDetails: Record<string, { wordCount: number; lastModified?: string }> = {};
  for (const p of pages) pageDetails[p.id] = { wordCount: p.wordCount ?? 0, lastModified: p.lastModified };

  const footerComments: CommentInfo[] = [
    { id: 'c1', pageId: 'mk-003', pageTitle: 'Healthcare AI Reference Architecture', author: 'Sarah Chen', body: '', created: daysAgo(10), type: 'footer' },
    { id: 'c2', pageId: 'mk-003', pageTitle: 'Healthcare AI Reference Architecture', author: 'Mike Johnson', body: '', created: daysAgo(12), type: 'footer' },
  ];

  const childrenOf = buildChildrenIndex(pages);
  const scored = computeScores(pages, { footerComments, inlineComments: [] }, pageDetails, childrenOf);

  return {
    generatedAt: new Date().toISOString(),
    space: { key: spaceKey, name: spaceName },
    statusBreakdown: buildStatusBreakdown(scored),
    summary: {
      averageScore: scored.averageScore,
      totalPages: scored.pageScores.length,
      healthyCount: scored.healthyCount,
      needsAttentionCount: scored.needsAttentionCount,
      staleCount: scored.staleCount,
      criticalCount: scored.criticalCount,
    },
    pages: scored.pageScores.map((p) => ({
      pageId: p.pageId,
      title: p.title,
      score: p.score,
      status: p.status,
      statusColor: STATUS_COLOR_MAP[p.status as HealthStatus] ?? '#9CA3AF',
      statusEmoji: STATUS_EMOJI_MAP[p.status as HealthStatus] ?? '⚪',
      staleness: p.factors.staleness,
      depth: p.factors.depth,
      commentActivity: p.factors.commentActivity,
      wordCount: p.factors.wordCount,
      topRecommendation: p.recommendations[0] ?? null,
    })),
    source: 'mock',
  };
}

export async function GET(request: Request) {
  if (!PUBLIC_MODE && !authorized(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const rawKey = searchParams.get('spaceKey') ?? 'HA';
  if (!/^[A-Z][A-Z0-9_]{0,9}$/.test(rawKey)) {
    return NextResponse.json({ error: 'Invalid spaceKey' }, { status: 400 });
  }

  try {
    if (isConfigured()) {
      try {
        const data = await fetchViaGateway(rawKey);
        return NextResponse.json(data);
      } catch (err) {
        console.warn('[dashboard-hub/knowledge-health] Gateway failed, using mock:', err instanceof Error ? err.message : err);
        return NextResponse.json(getMockPayload(rawKey));
      }
    }
    return NextResponse.json(getMockPayload(rawKey));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
