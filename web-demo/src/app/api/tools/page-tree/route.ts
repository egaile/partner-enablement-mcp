import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ATLASSIAN_CLOUD_ID, rovo, extractText } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { PageInfo, PageTreeNode, PageTreeData } from '@/types/api';

const InputSchema = z.object({
  spaceId: z.string().max(50),
  pageIds: z.array(z.string().max(50)).max(50),
}).strict();

/**
 * Build tree nodes recursively from flat page lists.
 * Each root page's descendants are fetched via getConfluencePageDescendants.
 */
async function fetchViaGateway(spaceId: string, pageIds: string[]): Promise<PageTreeData> {
  const allPages = new Map<string, PageInfo>();
  const pageDetails: Record<string, { wordCount: number; lastModified?: string }> = {};

  // Step 1: Fetch each root page's own data AND its descendants
  for (const pageId of pageIds) {
    // 1a: Fetch the root page itself so it appears in allPages
    try {
      const pageResult = await callTool(rovo('getConfluencePage'), {
        cloudId: ATLASSIAN_CLOUD_ID,
        pageId,
        contentFormat: 'markdown',
      });

      if (!pageResult.isError) {
        const pageText = extractText(pageResult);
        const pageData = JSON.parse(pageText);
        const body = (pageData?.body?.storage?.value as string) ??
          (pageData?.body?.view?.value as string) ??
          (typeof pageData?.body === 'string' ? pageData.body : '') ?? '';
        const wordCount = body.split(/\s+/).filter(Boolean).length;
        const lastMod = (pageData?.version?.when as string) ??
          (pageData?.version?.createdAt as string) ??
          (pageData?.lastModifiedDate as string) ?? undefined;

        allPages.set(pageId, {
          id: pageId,
          title: (pageData?.title as string) ?? '',
          spaceId,
          parentId: pageData?.parentId ? String(pageData.parentId) : undefined,
          status: (pageData?.status as string) ?? 'current',
          lastModified: lastMod,
          wordCount,
        });
        pageDetails[pageId] = { wordCount, lastModified: lastMod };
      }
    } catch (err) {
      console.warn(`[page-tree] Failed to fetch page ${pageId}:`, err instanceof Error ? err.message : err);
    }

    // 1b: Fetch descendants
    try {
      const descResult = await callTool(rovo('getConfluencePageDescendants'), {
        cloudId: ATLASSIAN_CLOUD_ID,
        pageId,
        limit: 50,
      });

      if (!descResult.isError) {
        const descText = extractText(descResult);
        const descData = JSON.parse(descText);
        const rawChildren = descData?.results ?? descData ?? [];

        for (const child of Array.isArray(rawChildren) ? rawChildren : []) {
          const childPage: PageInfo = {
            id: String(child.id ?? ''),
            title: (child.title as string) ?? '',
            spaceId,
            parentId: child.parentId ? String(child.parentId) : pageId,
            status: (child.status as string) ?? 'current',
            lastModified: (child.lastModifiedDate as string) ?? (child.modifiedAt as string) ?? undefined,
            authorName: ((child.author as Record<string, unknown>)?.displayName as string) ?? undefined,
          };
          allPages.set(childPage.id, childPage);
        }
      }
    } catch (err) {
      console.warn(`[page-tree] Failed to fetch descendants for ${pageId}:`, err instanceof Error ? err.message : err);
    }
  }

  // Step 2: Fetch word counts for child pages (up to 10)
  const childIds = Array.from(allPages.keys()).filter((id) => !pageIds.includes(id)).slice(0, 10);
  for (const childId of childIds) {
    try {
      const pageResult = await callTool(rovo('getConfluencePage'), {
        cloudId: ATLASSIAN_CLOUD_ID,
        pageId: childId,
        contentFormat: 'markdown',
      });

      if (!pageResult.isError) {
        const pageText = extractText(pageResult);
        const pageData = JSON.parse(pageText);
        const body = (pageData?.body?.storage?.value as string) ??
          (pageData?.body?.view?.value as string) ??
          (typeof pageData?.body === 'string' ? pageData.body : '') ?? '';
        const wordCount = body.split(/\s+/).filter(Boolean).length;
        const lastMod = (pageData?.version?.when as string) ??
          (pageData?.version?.createdAt as string) ??
          (pageData?.lastModifiedDate as string) ?? undefined;

        pageDetails[childId] = { wordCount, lastModified: lastMod };
        const existing = allPages.get(childId);
        if (existing) {
          existing.wordCount = wordCount;
          existing.lastModified = lastMod ?? existing.lastModified;
        }
      }
    } catch {
      // skip silently
    }
  }

  // If no pages were collected, the gateway responses couldn't be parsed — throw to trigger mock fallback
  if (allPages.size === 0) {
    throw new Error('Gateway returned no parseable page data');
  }

  // Step 3: Build tree structure
  return buildTree(pageIds, allPages, pageDetails, spaceId, 'gateway');
}

function buildTree(
  rootIds: string[],
  allPages: Map<string, PageInfo>,
  pageDetails: Record<string, { wordCount: number; lastModified?: string }>,
  spaceId: string,
  source: 'gateway' | 'mock'
): PageTreeData {
  // Index children by parentId
  const childrenOf = new Map<string, PageInfo[]>();
  for (const page of Array.from(allPages.values())) {
    if (page.parentId) {
      const siblings = childrenOf.get(page.parentId) ?? [];
      siblings.push(page);
      childrenOf.set(page.parentId, siblings);
    }
  }

  let maxDepth = 0;

  function buildNode(pageId: string, depth: number): PageTreeNode | null {
    const page = allPages.get(pageId);
    if (!page) return null;

    if (depth > maxDepth) maxDepth = depth;
    page.depth = depth;

    const children = (childrenOf.get(pageId) ?? [])
      .map((child) => buildNode(child.id, depth + 1))
      .filter((n): n is PageTreeNode => n !== null);

    return { page, children, depth };
  }

  const rootPages = rootIds
    .map((id) => buildNode(id, 0))
    .filter((n): n is PageTreeNode => n !== null);

  // Count orphans: pages not reachable from roots
  const reachable = new Set<string>();
  function markReachable(node: PageTreeNode) {
    reachable.add(node.page.id);
    for (const child of node.children) markReachable(child);
  }
  for (const root of rootPages) markReachable(root);

  const orphanCount = allPages.size - reachable.size;

  return {
    rootPages,
    totalPages: allPages.size,
    maxDepth,
    orphanCount,
    pageDetails,
    source,
  };
}

function getMockData(spaceId: string, _pageIds: string[]): PageTreeData {
  const pages = new Map<string, PageInfo>();

  // Homepage — always the mock root regardless of input pageIds
  const rootId = 'page-001';

  pages.set(rootId, {
    id: rootId,
    title: 'Healthcare AI Homepage',
    spaceId,
    status: 'current',
    lastModified: '2026-03-10T14:00:00.000Z',
    authorName: 'Sarah Chen',
    version: 5,
    wordCount: 450,
    depth: 0,
  });

  // Level 1 children of homepage
  pages.set('page-002', {
    id: 'page-002',
    title: 'AI Assistant Requirements',
    spaceId,
    parentId: rootId,
    status: 'current',
    lastModified: '2026-03-08T10:30:00.000Z',
    authorName: 'Mike Johnson',
    version: 3,
    wordCount: 1200,
    depth: 1,
  });

  pages.set('page-003', {
    id: 'page-003',
    title: 'Healthcare AI Reference Architecture',
    spaceId,
    parentId: rootId,
    status: 'current',
    lastModified: '2026-02-28T16:45:00.000Z',
    authorName: 'Sarah Chen',
    version: 7,
    wordCount: 2800,
    depth: 1,
  });

  pages.set('page-006', {
    id: 'page-006',
    title: 'HIPAA Compliance Policy',
    spaceId,
    parentId: rootId,
    status: 'current',
    lastModified: '2026-03-12T08:00:00.000Z',
    authorName: 'Sarah Chen',
    version: 9,
    wordCount: 3200,
    depth: 1,
  });

  pages.set('page-007', {
    id: 'page-007',
    title: 'PHI Data Classification Guide',
    spaceId,
    parentId: rootId,
    status: 'current',
    lastModified: '2026-02-10T13:30:00.000Z',
    authorName: 'David Park',
    version: 3,
    wordCount: 1800,
    depth: 1,
  });

  // Level 2 children of Reference Architecture
  pages.set('page-004', {
    id: 'page-004',
    title: 'EHR Integration Specifications',
    spaceId,
    parentId: 'page-003',
    status: 'current',
    lastModified: '2026-02-20T09:15:00.000Z',
    authorName: 'David Park',
    version: 4,
    wordCount: 1500,
    depth: 2,
  });

  pages.set('page-005', {
    id: 'page-005',
    title: 'AI Model Deployment Checklist',
    spaceId,
    parentId: 'page-003',
    status: 'current',
    lastModified: '2026-01-15T11:00:00.000Z',
    authorName: 'Mike Johnson',
    version: 2,
    wordCount: 650,
    depth: 2,
  });

  const pageDetails: Record<string, { wordCount: number; lastModified?: string }> = {};
  for (const [id, page] of Array.from(pages.entries())) {
    pageDetails[id] = {
      wordCount: page.wordCount ?? 0,
      lastModified: page.lastModified,
    };
  }

  // Always use mock's own root — caller's pageIds are real Confluence IDs that don't match mock data
  return buildTree([rootId], pages, pageDetails, spaceId, 'mock');
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
    const { spaceId, pageIds } = parsed.data;

    let data: PageTreeData;

    if (isConfigured()) {
      try {
        data = await fetchViaGateway(spaceId, pageIds);
      } catch (err) {
        console.warn(
          '[page-tree] Gateway failed, using mock:',
          err instanceof Error ? err.message : err
        );
        resetSession();
        data = getMockData(spaceId, pageIds);
      }
    } else {
      data = getMockData(spaceId, pageIds);
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
