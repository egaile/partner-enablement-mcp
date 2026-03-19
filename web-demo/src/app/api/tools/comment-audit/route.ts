import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ATLASSIAN_CLOUD_ID, rovo, extractText } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { CommentInfo, CommentAuditData } from '@/types/api';

const PageRefSchema = z.object({
  id: z.string().max(50),
  title: z.string().max(500),
});

const InputSchema = z.object({
  pageIds: z.array(PageRefSchema).max(50),
  upstreamSource: z.enum(['gateway', 'mock']).optional(),
}).strict();

/**
 * Parse a CQL search result into CommentInfo.
 * CQL results have: id, title, type, excerpt, lastModified, url, space, etc.
 * The comment "container" is the parent page.
 */
function parseSearchResult(
  raw: Record<string, unknown>,
  pageId: string,
  pageTitle: string,
): CommentInfo {
  // CQL search returns excerpt (plain text) and content metadata
  const excerpt = (raw.excerpt as string) ?? (raw.title as string) ?? '';
  // Strip HTML tags from excerpt
  const cleanBody = excerpt.replace(/<[^>]*>/g, '').trim();

  // Try to get author from various possible fields
  const lastModifiedBy = raw.lastModifiedBy as Record<string, unknown> | undefined;
  const author = (lastModifiedBy?.displayName as string) ??
    (lastModifiedBy?.publicName as string) ??
    ((raw.history as Record<string, unknown>)?.createdBy as Record<string, unknown>)?.displayName as string ??
    'Unknown';

  const created = (raw.lastModified as string) ??
    ((raw.history as Record<string, unknown>)?.createdDate as string) ?? '';

  // Confluence search results don't distinguish footer/inline in CQL results
  // Treat all as footer comments (the most common type)
  return {
    id: String(raw.id ?? ''),
    pageId,
    pageTitle,
    author,
    body: cleanBody.slice(0, 500) || '(comment body not available in search results)',
    created,
    type: 'footer',
    replyCount: 0,
  };
}

/**
 * Use searchConfluenceUsingCql to find comments on pages.
 * The Rovo MCP doesn't expose getConfluencePageFooterComments/InlineComments,
 * but searchConfluenceUsingCql IS available and can find comments via CQL.
 */
async function fetchViaGateway(
  pageIds: Array<{ id: string; title: string }>
): Promise<CommentAuditData> {
  const footerComments: CommentInfo[] = [];
  const inlineComments: CommentInfo[] = [];
  const pagesWithComments = new Set<string>();

  // Build a title lookup map
  const titleMap = new Map(pageIds.map((p) => [p.id, p.title]));

  // Search for comments across all pages in a single CQL query
  // CQL: type = comment AND container IN (id1, id2, ...)
  const pageIdList = pageIds.map((p) => p.id).join(',');
  const cql = `type = comment AND container IN (${pageIdList})`;

  try {
    const searchResult = await callTool(rovo('searchConfluenceUsingCql'), {
      cloudId: ATLASSIAN_CLOUD_ID,
      cql,
      limit: 50,
    });

    if (searchResult.isError) {
      const errText = extractText(searchResult);
      console.warn('[comment-audit] CQL search error:', errText);
      // Fall back to per-page search if batch fails
      return await fetchPerPage(pageIds, titleMap);
    }

    const searchText = extractText(searchResult);
    if (searchText) {
      const searchData = JSON.parse(searchText);
      const results = searchData?.results ?? (Array.isArray(searchData) ? searchData : []);

      for (const raw of Array.isArray(results) ? results : []) {
        // Determine which page this comment belongs to
        const container = raw.container as Record<string, unknown> | undefined;
        const containerId = container ? String(container.id ?? '') : '';
        const containerTitle = container
          ? (container.title as string) ?? titleMap.get(containerId) ?? 'Unknown Page'
          : 'Unknown Page';

        // Use the container ID if available, otherwise try to match
        const pageId = containerId || pageIds[0]?.id || '';
        const pageTitle = containerTitle;

        const comment = parseSearchResult(raw as Record<string, unknown>, pageId, pageTitle);
        footerComments.push(comment);
        if (pageId) pagesWithComments.add(pageId);
      }
    }
  } catch (err) {
    console.warn('[comment-audit] CQL search failed:', err instanceof Error ? err.message : err);
    // Fall back to per-page search
    return await fetchPerPage(pageIds, titleMap);
  }

  const totalComments = footerComments.length + inlineComments.length;
  const unresolvedInline = inlineComments.filter((c) => c.resolved === false).length;

  return {
    footerComments,
    inlineComments,
    totalComments,
    unresolvedInline,
    pagesWithComments: pagesWithComments.size,
    pagesWithoutComments: pageIds.length - pagesWithComments.size,
    source: 'gateway',
  };
}

/**
 * Fallback: search for comments one page at a time if batch CQL fails.
 */
async function fetchPerPage(
  pageIds: Array<{ id: string; title: string }>,
  titleMap: Map<string, string>,
): Promise<CommentAuditData> {
  const footerComments: CommentInfo[] = [];
  const pagesWithComments = new Set<string>();

  for (const { id: pageId, title: pageTitle } of pageIds) {
    try {
      const cql = `type = comment AND container = ${pageId}`;
      const result = await callTool(rovo('searchConfluenceUsingCql'), {
        cloudId: ATLASSIAN_CLOUD_ID,
        cql,
        limit: 25,
      });

      if (!result.isError) {
        const text = extractText(result);
        if (text) {
          const data = JSON.parse(text);
          const results = data?.results ?? (Array.isArray(data) ? data : []);
          for (const raw of Array.isArray(results) ? results : []) {
            const comment = parseSearchResult(raw as Record<string, unknown>, pageId, pageTitle);
            footerComments.push(comment);
            pagesWithComments.add(pageId);
          }
        }
      }
    } catch {
      // Skip this page silently
    }
  }

  return {
    footerComments,
    inlineComments: [],
    totalComments: footerComments.length,
    unresolvedInline: 0,
    pagesWithComments: pagesWithComments.size,
    pagesWithoutComments: pageIds.length - pagesWithComments.size,
    source: 'gateway',
  };
}

function getMockData(
  pageIds: Array<{ id: string; title: string }>
): CommentAuditData {
  // Build a lookup for page titles
  const titleMap = new Map(pageIds.map((p) => [p.id, p.title]));
  const getTitle = (id: string) => titleMap.get(id) ?? 'Unknown Page';

  const footerComments: CommentInfo[] = [
    {
      id: 'fc-001',
      pageId: pageIds[0]?.id ?? 'page-001',
      pageTitle: getTitle(pageIds[0]?.id ?? 'page-001'),
      author: 'Sarah Chen',
      body: 'Updated the reference architecture to reflect the new FHIR R4 integration requirements. Please review the data flow diagrams.',
      created: '2026-03-09T10:15:00.000Z',
      type: 'footer',
      replyCount: 1,
      replies: [
        {
          id: 'fc-001-r1',
          pageId: pageIds[0]?.id ?? 'page-001',
          pageTitle: getTitle(pageIds[0]?.id ?? 'page-001'),
          author: 'Mike Johnson',
          body: 'Looks good. The FHIR Patient resource mapping needs one more field - mrn (Medical Record Number).',
          created: '2026-03-09T14:30:00.000Z',
          type: 'footer',
        },
      ],
    },
    {
      id: 'fc-002',
      pageId: pageIds[1]?.id ?? 'page-002',
      pageTitle: getTitle(pageIds[1]?.id ?? 'page-002'),
      author: 'David Park',
      body: 'Added new AI model evaluation criteria based on latest regulatory guidance from HHS.',
      created: '2026-03-07T16:00:00.000Z',
      type: 'footer',
      replyCount: 0,
    },
    {
      id: 'fc-003',
      pageId: pageIds[2]?.id ?? 'page-003',
      pageTitle: getTitle(pageIds[2]?.id ?? 'page-003'),
      author: 'Mike Johnson',
      body: 'The EHR integration specs need to be updated for the new Epic API version. Can someone from the integration team review?',
      created: '2026-02-25T11:45:00.000Z',
      type: 'footer',
      replyCount: 1,
      replies: [
        {
          id: 'fc-003-r1',
          pageId: pageIds[2]?.id ?? 'page-003',
          pageTitle: getTitle(pageIds[2]?.id ?? 'page-003'),
          author: 'Sarah Chen',
          body: 'I will update this next sprint. The new Epic February 2026 release has breaking changes in the Encounter resource.',
          created: '2026-02-26T09:00:00.000Z',
          type: 'footer',
        },
      ],
    },
    {
      id: 'fc-004',
      pageId: pageIds.length > 5 ? pageIds[5].id : 'page-006',
      pageTitle: getTitle(pageIds.length > 5 ? pageIds[5].id : 'page-006'),
      author: 'Sarah Chen',
      body: 'HIPAA compliance section 4.2 updated to include new AI-specific requirements from the 2026 HIPAA Security Rule update.',
      created: '2026-03-11T08:30:00.000Z',
      type: 'footer',
      replyCount: 0,
    },
  ];

  const inlineComments: CommentInfo[] = [
    {
      id: 'ic-001',
      pageId: pageIds.length > 5 ? pageIds[5].id : 'page-006',
      pageTitle: getTitle(pageIds.length > 5 ? pageIds[5].id : 'page-006'),
      author: 'David Park',
      body: 'This encryption requirement should specify AES-256-GCM, not just AES-256. GCM provides authenticated encryption which is required for PHI transport.',
      created: '2026-03-10T15:20:00.000Z',
      type: 'inline',
      resolved: false,
    },
    {
      id: 'ic-002',
      pageId: pageIds.length > 6 ? pageIds[6].id : 'page-007',
      pageTitle: getTitle(pageIds.length > 6 ? pageIds[6].id : 'page-007'),
      author: 'Mike Johnson',
      body: 'The PHI data classification tiers need a Tier 0 for fully de-identified data that can be used in AI training without restrictions.',
      created: '2026-02-08T13:00:00.000Z',
      type: 'inline',
      resolved: false,
    },
    {
      id: 'ic-003',
      pageId: pageIds.length > 5 ? pageIds[5].id : 'page-006',
      pageTitle: getTitle(pageIds.length > 5 ? pageIds[5].id : 'page-006'),
      author: 'Sarah Chen',
      body: 'Access control matrix reviewed and approved. RBAC roles are correctly mapped to HIPAA minimum necessary standard.',
      created: '2026-03-05T10:00:00.000Z',
      type: 'inline',
      resolved: true,
    },
  ];

  const pagesWithCommentIds = new Set<string>();
  for (const c of [...footerComments, ...inlineComments]) {
    pagesWithCommentIds.add(c.pageId);
  }

  const totalComments = footerComments.length + inlineComments.length;
  const unresolvedInline = inlineComments.filter((c) => c.resolved === false).length;

  return {
    footerComments,
    inlineComments,
    totalComments,
    unresolvedInline,
    pagesWithComments: pagesWithCommentIds.size,
    pagesWithoutComments: pageIds.length - pagesWithCommentIds.size,
    source: 'mock',
  };
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }
    const { pageIds, upstreamSource } = parsed.data;

    let data: CommentAuditData;

    // If upstream data was mock (e.g. space-discovery fell back), use mock here too
    // Mock page IDs like "page-001" won't work with the real Confluence API
    const hasMockIds = pageIds.some((p) => p.id.startsWith('page-'));
    const shouldUseMock = upstreamSource === 'mock' || hasMockIds;

    if (isConfigured() && !shouldUseMock) {
      try {
        data = await fetchViaGateway(pageIds);
      } catch (err) {
        console.warn(
          '[comment-audit] Gateway failed, using mock:',
          err instanceof Error ? err.message : err
        );
        resetSession();
        data = getMockData(pageIds);
      }
    } else {
      data = getMockData(pageIds);
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
