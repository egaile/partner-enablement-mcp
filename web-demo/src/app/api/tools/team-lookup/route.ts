import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ROVO_SERVER_NAME, ProjectKeySchema } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { TeamMember, TeamLookupData } from '@/types/api';

function rovo(toolName: string): string {
  return `${ROVO_SERVER_NAME}__${toolName}`;
}

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.find((c) => c.type === 'text')?.text ?? '';
}

const TeamLookupInputSchema = z.object({
  projectKey: ProjectKeySchema,
  query: z.string().max(100).optional(),
}).strict();

const CLOUD_ID = '7c2ac73e-d0b6-4fa3-8059-3d5aa405c0e1';

async function fetchViaGateway(projectKey: string, query: string): Promise<TeamLookupData> {
  // Step 1: Get cloudId
  let cloudId: string;
  try {
    const resourcesResult = await callTool(rovo('getAccessibleAtlassianResources'), {});
    if (resourcesResult.isError) throw new Error(extractText(resourcesResult));
    const resources = JSON.parse(extractText(resourcesResult));
    cloudId = Array.isArray(resources) ? resources[0]?.id : resources?.id;
    if (!cloudId) throw new Error('No Atlassian cloud resources found');
  } catch {
    cloudId = CLOUD_ID;
  }

  // Step 2: If no query provided, try to get the project lead name for the search
  let searchQuery = query;
  if (!searchQuery) {
    try {
      const projectsResult = await callTool(rovo('getVisibleJiraProjects'), {
        cloudId,
        searchString: projectKey,
        maxResults: 1,
      });
      if (!projectsResult.isError) {
        const projectsData = JSON.parse(extractText(projectsResult));
        const projects = projectsData?.values ?? projectsData ?? [];
        const project = Array.isArray(projects)
          ? projects.find((p: Record<string, unknown>) => p.key === projectKey)
          : null;
        if (project?.lead?.displayName) {
          searchQuery = project.lead.displayName as string;
        }
      }
    } catch {
      // Fall through with empty query
    }
    if (!searchQuery) searchQuery = projectKey;
  }

  // Step 3: Lookup users
  const lookupResult = await callTool(rovo('lookupJiraAccountId'), {
    cloudId,
    searchString: searchQuery,
  });
  if (lookupResult.isError) throw new Error(`Lookup error: ${extractText(lookupResult)}`);

  const lookupData = JSON.parse(extractText(lookupResult));
  const rawUsers = Array.isArray(lookupData) ? lookupData : lookupData?.users ?? lookupData?.values ?? [];

  const members: TeamMember[] = (Array.isArray(rawUsers) ? rawUsers : []).map(
    (u: Record<string, unknown>) => ({
      accountId: (u.accountId as string) ?? '',
      displayName: (u.displayName as string) ?? 'Unknown',
      emailAddress: (u.emailAddress as string) ?? undefined,
      active: (u.active as boolean) ?? true,
      avatarUrl:
        ((u.avatarUrls as Record<string, unknown>)?.['48x48'] as string) ??
        ((u.avatarUrls as Record<string, unknown>)?.['32x32'] as string) ??
        (u.avatarUrl as string) ??
        undefined,
    })
  );

  return {
    members,
    searchQuery,
    source: 'gateway',
  };
}

function getMockData(query: string): TeamLookupData {
  const allMembers: TeamMember[] = [
    {
      accountId: 'mock-001',
      displayName: 'Ed Gaile',
      emailAddress: 'ed.gaile@example.com',
      active: true,
      avatarUrl: undefined,
    },
    {
      accountId: 'mock-002',
      displayName: 'Sarah Chen',
      emailAddress: 'sarah.chen@example.com',
      active: true,
      avatarUrl: undefined,
    },
    {
      accountId: 'mock-003',
      displayName: 'Marcus Johnson',
      emailAddress: 'marcus.johnson@example.com',
      active: true,
      avatarUrl: undefined,
    },
  ];

  // Filter by query if provided
  const filteredMembers = query
    ? allMembers.filter((m) =>
        m.displayName.toLowerCase().includes(query.toLowerCase()) ||
        (m.emailAddress?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : allMembers;

  return {
    members: filteredMembers.length > 0 ? filteredMembers : allMembers,
    searchQuery: query || 'team',
    source: 'mock',
  };
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = TeamLookupInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }
    const { projectKey, query } = parsed.data;

    let data: TeamLookupData;

    if (isConfigured()) {
      try {
        data = await fetchViaGateway(projectKey, query ?? '');
      } catch (err) {
        console.warn(
          '[team-lookup] Gateway failed, using mock:',
          err instanceof Error ? err.message : err
        );
        resetSession();
        data = getMockData(query ?? '');
      }
    } else {
      data = getMockData(query ?? '');
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
