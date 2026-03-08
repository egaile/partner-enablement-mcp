import { NextResponse } from 'next/server';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ROVO_SERVER_NAME, CreateIssuesInputSchema } from '../_shared';
import { rateLimit } from '../_rateLimit';

function rovo(toolName: string): string {
  return `${ROVO_SERVER_NAME}__${toolName}`;
}

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

export interface CreatedIssue {
  key: string;
  summary: string;
  type: string;
  url?: string;
}

export interface CreateIssuesResponse {
  success: boolean;
  issues?: CreatedIssue[];
  approvalRequired?: boolean;
  policyBlocked?: boolean;
  blockReason?: string;
  source: 'gateway' | 'mock';
}

interface TicketInput {
  summary: string;
  description: string;
  type: string;
}

async function createViaGateway(projectKey: string, tickets: TicketInput[]): Promise<CreateIssuesResponse> {
  // Step 1: Get cloudId
  const resourcesResult = await callTool(rovo('getAccessibleAtlassianResources'), {});
  if (resourcesResult.isError) throw new Error(`Tool error: ${extractText(resourcesResult)}`);
  const resources = JSON.parse(extractText(resourcesResult));
  const cloudId: string = Array.isArray(resources) ? resources[0]?.id : resources?.id;
  if (!cloudId) throw new Error('No Atlassian cloud resources found');

  // Step 2: Create issues (limit to 5)
  const toCreate = tickets.slice(0, 5);
  const created: CreatedIssue[] = [];

  for (const ticket of toCreate) {
    const result = await callTool(rovo('createJiraIssue'), {
      cloudId,
      projectKey,
      issueTypeName: ticket.type === 'epic' ? 'Epic' : ticket.type === 'story' ? 'Story' : 'Task',
      summary: ticket.summary,
      description: ticket.description,
    });

    if (result.isError) {
      const errText = extractText(result);

      // Check for approval required
      if (errText.toLowerCase().includes('approval') || errText.toLowerCase().includes('pending')) {
        return {
          success: false,
          approvalRequired: true,
          blockReason: 'Write operations to Jira require approval from an admin. A request has been submitted to the approval queue.',
          issues: created,
          source: 'gateway',
        };
      }

      // Check for policy block
      if (errText.toLowerCase().includes('policy') || errText.toLowerCase().includes('denied') || errText.toLowerCase().includes('blocked')) {
        return {
          success: false,
          policyBlocked: true,
          blockReason: errText,
          issues: created,
          source: 'gateway',
        };
      }

      throw new Error(`Tool error creating issue: ${errText}`);
    }

    const issueText = extractText(result);
    const issueData = JSON.parse(issueText);

    created.push({
      key: (issueData?.key as string) ?? `${projectKey}-???`,
      summary: ticket.summary,
      type: ticket.type,
      url: (issueData?.self as string) ?? '',
    });
  }

  return {
    success: true,
    issues: created,
    source: 'gateway',
  };
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = CreateIssuesInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }
    const { projectKey, tickets } = parsed.data;

    let response: CreateIssuesResponse;

    if (isConfigured()) {
      try {
        response = await createViaGateway(projectKey, tickets);
      } catch (err) {
        console.warn('[create-jira-issues] Gateway failed, using mock:', err instanceof Error ? err.message : err);
        resetSession();
        response = mockCreate(projectKey, tickets);
      }
    } else {
      response = mockCreate(projectKey, tickets);
    }

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function mockCreate(projectKey: string, tickets: TicketInput[]): CreateIssuesResponse {
  const baseNum = 100 + Math.floor(Math.random() * 900);
  const created: CreatedIssue[] = tickets.slice(0, 5).map((t, i) => ({
    key: `${projectKey}-${baseNum + i}`,
    summary: t.summary,
    type: t.type,
    url: `https://your-domain.atlassian.net/browse/${projectKey}-${baseNum + i}`,
  }));

  return {
    success: true,
    issues: created,
    source: 'mock',
  };
}
