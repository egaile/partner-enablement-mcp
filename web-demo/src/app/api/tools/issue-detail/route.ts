import { NextResponse } from 'next/server';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ROVO_SERVER_NAME } from '../_shared';
import { rateLimit } from '../_rateLimit';

/** Prefix a Rovo tool name with the configured server name */
function rovo(toolName: string): string {
  return `${ROVO_SERVER_NAME}__${toolName}`;
}

/** Extract the first text content block from an MCP tool result */
function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

interface IssueDetailResponse {
  key: string;
  summary: string;
  description?: string;
  type: string;
  status: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  created?: string;
  updated?: string;
  labels: string[];
  components: string[];
  commentCount?: number;
}

async function fetchViaGateway(cloudId: string, issueKey: string): Promise<IssueDetailResponse> {
  const result = await callTool(rovo('getJiraIssue'), {
    cloudId,
    issueIdOrKey: issueKey,
    fields: ['summary', 'description', 'status', 'issuetype', 'priority', 'assignee', 'reporter', 'created', 'updated', 'labels', 'components', 'comment'],
  });

  if (result.isError) {
    throw new Error(`Tool error: ${extractText(result)}`);
  }

  const text = extractText(result);
  const data = JSON.parse(text);
  const fields = (data.fields ?? data) as Record<string, unknown>;

  // Extract comment count from various possible structures
  let commentCount = 0;
  const comment = fields.comment as Record<string, unknown> | undefined;
  if (comment) {
    commentCount = (comment.total as number) ?? (comment.comments as unknown[] | undefined)?.length ?? 0;
  }

  // Extract components array
  const rawComponents = (fields.components ?? []) as Array<Record<string, unknown>>;
  const components = rawComponents.map((c) => (c.name as string) ?? '').filter(Boolean);

  return {
    key: (data.key as string) ?? issueKey,
    summary: (fields.summary as string) ?? '',
    description: (fields.description as string) || undefined,
    type:
      ((fields.issuetype as Record<string, unknown>)?.name as string) ??
      (fields.issuetype as string) ?? 'Unknown',
    status:
      ((fields.status as Record<string, unknown>)?.name as string) ??
      (fields.status as string) ?? 'Unknown',
    priority:
      ((fields.priority as Record<string, unknown>)?.name as string) ?? undefined,
    assignee:
      ((fields.assignee as Record<string, unknown>)?.displayName as string) ?? undefined,
    reporter:
      ((fields.reporter as Record<string, unknown>)?.displayName as string) ?? undefined,
    created: (fields.created as string) ?? undefined,
    updated: (fields.updated as string) ?? undefined,
    labels: (fields.labels as string[]) ?? [],
    components,
    commentCount,
  };
}

function getMockIssueDetail(issueKey: string): IssueDetailResponse {
  const isHealth = issueKey.startsWith('HEALTH');

  const mockDetails: Record<string, IssueDetailResponse> = {
    'HEALTH-1': {
      key: 'HEALTH-1',
      summary: 'Implement HIPAA-compliant patient intake flow',
      description: 'Build the core patient intake flow with HIPAA compliance requirements. Must integrate with Epic EHR via FHIR R4 APIs. Key requirements:\n\n- Secure authentication via MyChart SSO\n- PHI encryption at rest and in transit\n- Audit logging for all data access\n- Consent management workflow\n- Integration with Epic FHIR Patient resource',
      type: 'Epic',
      status: 'In Progress',
      priority: 'High',
      assignee: 'Sarah Chen',
      reporter: 'Mike Johnson',
      created: '2026-02-15T10:30:00.000Z',
      updated: '2026-03-05T14:22:00.000Z',
      labels: ['hipaa', 'phi', 'epic-ehr', 'compliance'],
      components: ['Patient Intake', 'FHIR Integration'],
      commentCount: 8,
    },
    'HEALTH-2': {
      key: 'HEALTH-2',
      summary: 'Set up FHIR R4 API integration layer',
      description: 'Create the integration layer for communicating with Epic EHR via FHIR R4 APIs. Implement Patient, Encounter, and DocumentReference resources.',
      type: 'Story',
      status: 'To Do',
      priority: 'High',
      assignee: 'David Park',
      reporter: 'Sarah Chen',
      created: '2026-02-18T09:15:00.000Z',
      updated: '2026-03-01T11:45:00.000Z',
      labels: ['fhir', 'integration', 'epic-ehr'],
      components: ['FHIR Integration'],
      commentCount: 3,
    },
    'FINSERV-1': {
      key: 'FINSERV-1',
      summary: 'Implement document processing pipeline for loan applications',
      description: 'Build the end-to-end document processing pipeline for automated loan application processing. Must support:\n\n- PDF and image document ingestion\n- OCR via AWS Textract\n- Structured field extraction with Claude\n- PCI-DSS compliant data handling\n- Confidence scoring and human review triggers',
      type: 'Epic',
      status: 'In Progress',
      priority: 'High',
      assignee: 'Alex Rivera',
      reporter: 'Jennifer Lee',
      created: '2026-02-20T08:00:00.000Z',
      updated: '2026-03-06T16:30:00.000Z',
      labels: ['pci_dss', 'document-processing', 'loan-automation'],
      components: ['Document Pipeline', 'AI Processing'],
      commentCount: 12,
    },
    'FINSERV-2': {
      key: 'FINSERV-2',
      summary: 'Build SOC2-compliant audit trail for AI decisions',
      description: 'Implement comprehensive audit logging for all AI-powered decisions in the loan processing workflow. Must meet SOC2 Type II evidence requirements.',
      type: 'Story',
      status: 'To Do',
      priority: 'High',
      assignee: 'Chris Taylor',
      reporter: 'Alex Rivera',
      created: '2026-02-22T11:00:00.000Z',
      updated: '2026-03-02T09:15:00.000Z',
      labels: ['soc2', 'audit', 'compliance'],
      components: ['Compliance'],
      commentCount: 5,
    },
  };

  if (mockDetails[issueKey]) {
    return mockDetails[issueKey];
  }

  // Generic fallback for unknown issue keys
  return {
    key: issueKey,
    summary: `${issueKey} - Issue details`,
    description: 'Detailed description for this issue would be fetched from Jira.',
    type: 'Task',
    status: 'To Do',
    priority: 'Medium',
    assignee: isHealth ? 'Sarah Chen' : 'Alex Rivera',
    reporter: isHealth ? 'Mike Johnson' : 'Jennifer Lee',
    created: '2026-02-25T10:00:00.000Z',
    updated: '2026-03-05T15:00:00.000Z',
    labels: [],
    components: [],
    commentCount: 2,
  };
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const { issueKey, cloudId } = body as { issueKey?: string; cloudId?: string };

    if (!issueKey) {
      return NextResponse.json({ error: 'issueKey is required' }, { status: 400 });
    }

    let detail: IssueDetailResponse;

    if (isConfigured() && cloudId) {
      try {
        detail = await fetchViaGateway(cloudId, issueKey);
      } catch (err) {
        console.warn(
          `[issue-detail] Gateway failed for ${issueKey}, falling back to mock:`,
          err instanceof Error ? err.message : err
        );
        resetSession();
        detail = getMockIssueDetail(issueKey);
      }
    } else {
      detail = getMockIssueDetail(issueKey);
    }

    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
