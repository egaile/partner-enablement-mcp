import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ROVO_SERVER_NAME } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { SpaceInfo, PageInfo, SpaceDiscoveryData } from '@/types/api';

const CLOUD_ID = '7c2ac73e-d0b6-4fa3-8059-3d5aa405c0e1';

const InputSchema = z.object({
  spaceId: z.string().max(50).optional(),
}).strict();

function rovo(toolName: string): string {
  return `${ROVO_SERVER_NAME}__${toolName}`;
}

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

async function fetchViaGateway(spaceId?: string): Promise<SpaceDiscoveryData> {
  // Step 1: List all spaces
  const spacesResult = await callTool(rovo('getConfluenceSpaces'), {
    cloudId: CLOUD_ID,
  });
  if (spacesResult.isError) {
    throw new Error(`Tool error: ${extractText(spacesResult)}`);
  }
  const spacesText = extractText(spacesResult);
  const spacesData = JSON.parse(spacesText);
  const rawSpaces = spacesData?.results ?? spacesData ?? [];

  const spaces: SpaceInfo[] = (Array.isArray(rawSpaces) ? rawSpaces : []).map(
    (s: Record<string, unknown>) => ({
      id: String(s.id ?? ''),
      key: (s.key as string) ?? '',
      name: (s.name as string) ?? '',
      type: (s.type as string) ?? 'global',
      description: (s.description as string) ?? undefined,
    })
  );

  if (spaces.length === 0) {
    throw new Error('No Confluence spaces found');
  }

  // Step 2: Pick selected space
  const selectedSpace = spaceId
    ? spaces.find((s) => s.id === spaceId) ?? spaces[0]
    : spaces[0];

  // Step 3: Get pages in that space
  const pagesResult = await callTool(rovo('getPagesInConfluenceSpace'), {
    cloudId: CLOUD_ID,
    spaceId: selectedSpace.id,
    limit: 50,
    sort: '-modified-date',
  });
  if (pagesResult.isError) {
    throw new Error(`Tool error: ${extractText(pagesResult)}`);
  }
  const pagesText = extractText(pagesResult);
  const pagesData = JSON.parse(pagesText);
  const rawPages = pagesData?.results ?? pagesData ?? [];

  const pages: PageInfo[] = (Array.isArray(rawPages) ? rawPages : []).map(
    (p: Record<string, unknown>) => ({
      id: String(p.id ?? ''),
      title: (p.title as string) ?? '',
      spaceId: selectedSpace.id,
      parentId: p.parentId ? String(p.parentId) : undefined,
      status: (p.status as string) ?? 'current',
      lastModified: (p.lastModifiedDate as string) ?? (p.modifiedAt as string) ?? undefined,
      authorName: ((p.author as Record<string, unknown>)?.displayName as string) ?? undefined,
      version: typeof p.version === 'object'
        ? ((p.version as Record<string, unknown>)?.number as number) ?? undefined
        : (p.version as number) ?? undefined,
    })
  );

  return {
    spaces,
    selectedSpace,
    pages,
    source: 'gateway',
  };
}

function getMockData(spaceId?: string): SpaceDiscoveryData {
  const haSpace: SpaceInfo = {
    id: '1081348',
    key: 'HA',
    name: 'Healthcare AI',
    type: 'global',
    description: 'Healthcare AI deployment documentation and compliance guides',
  };

  const finsSpace: SpaceInfo = {
    id: '1310728',
    key: 'FINS',
    name: 'Financial Services',
    type: 'global',
    description: 'Financial services AI compliance and architecture documentation',
  };

  const spaces = [haSpace, finsSpace];
  const selectedSpace = spaceId
    ? spaces.find((s) => s.id === spaceId) ?? haSpace
    : haSpace;

  const pages: PageInfo[] = [
    {
      id: 'page-001',
      title: 'Healthcare AI Homepage',
      spaceId: selectedSpace.id,
      status: 'current',
      lastModified: '2026-03-10T14:00:00.000Z',
      authorName: 'Sarah Chen',
      version: 5,
    },
    {
      id: 'page-002',
      title: 'AI Assistant Requirements',
      spaceId: selectedSpace.id,
      parentId: 'page-001',
      status: 'current',
      lastModified: '2026-03-08T10:30:00.000Z',
      authorName: 'Mike Johnson',
      version: 3,
    },
    {
      id: 'page-003',
      title: 'Healthcare AI Reference Architecture',
      spaceId: selectedSpace.id,
      parentId: 'page-001',
      status: 'current',
      lastModified: '2026-02-28T16:45:00.000Z',
      authorName: 'Sarah Chen',
      version: 7,
    },
    {
      id: 'page-004',
      title: 'EHR Integration Specifications',
      spaceId: selectedSpace.id,
      parentId: 'page-003',
      status: 'current',
      lastModified: '2026-02-20T09:15:00.000Z',
      authorName: 'David Park',
      version: 4,
    },
    {
      id: 'page-005',
      title: 'AI Model Deployment Checklist',
      spaceId: selectedSpace.id,
      parentId: 'page-003',
      status: 'current',
      lastModified: '2026-01-15T11:00:00.000Z',
      authorName: 'Mike Johnson',
      version: 2,
    },
    {
      id: 'page-006',
      title: 'HIPAA Compliance Policy',
      spaceId: selectedSpace.id,
      parentId: 'page-001',
      status: 'current',
      lastModified: '2026-03-12T08:00:00.000Z',
      authorName: 'Sarah Chen',
      version: 9,
    },
    {
      id: 'page-007',
      title: 'PHI Data Classification Guide',
      spaceId: selectedSpace.id,
      parentId: 'page-001',
      status: 'current',
      lastModified: '2026-02-10T13:30:00.000Z',
      authorName: 'David Park',
      version: 3,
    },
  ];

  return {
    spaces,
    selectedSpace,
    pages,
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
    const { spaceId } = parsed.data;

    let data: SpaceDiscoveryData;

    if (isConfigured()) {
      try {
        data = await fetchViaGateway(spaceId);
      } catch (err) {
        console.warn(
          '[space-discovery] Gateway failed, using mock:',
          err instanceof Error ? err.message : err
        );
        resetSession();
        data = getMockData(spaceId);
      }
    } else {
      data = getMockData(spaceId);
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
