import { NextResponse } from 'next/server';
import { callTool, isConfigured } from '@/lib/gateway-client';
import { ProjectKeySchema, ATLASSIAN_CLOUD_ID, rovo, extractText } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { IssueDeepDiveIssue, IssueLinkType, IssueDeepDiveData } from '@/types/api';

/** Extract plain text from Jira ADF descriptions */
function extractAdfText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  if (n.type === 'text' && typeof n.text === 'string') return n.text;
  const content = n.content as unknown[] | undefined;
  if (!Array.isArray(content)) return '';
  return content.map(extractAdfText).join(n.type === 'paragraph' ? '\n' : '');
}

/** Convert seconds to a human-readable time string */
function formatTimeSpent(seconds: number): string {
  if (seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

async function fetchViaGateway(projectKey: string): Promise<IssueDeepDiveData> {
  // Step 1: Get cloudId
  let cloudId: string;
  try {
    const resourcesResult = await callTool(rovo('getAccessibleAtlassianResources'), {});
    if (resourcesResult.isError) throw new Error(extractText(resourcesResult));
    const resources = JSON.parse(extractText(resourcesResult));
    cloudId = Array.isArray(resources) ? resources[0]?.id : resources?.id;
    if (!cloudId) throw new Error('No Atlassian cloud resources found');
  } catch {
    cloudId = ATLASSIAN_CLOUD_ID;
  }

  // Step 2: Search for in-progress issues
  const jql = `project = ${projectKey} AND status = "In Progress" ORDER BY updated DESC`;
  const searchResult = await callTool(rovo('searchJiraIssuesUsingJql'), {
    cloudId,
    jql,
    maxResults: 10,
    fields: ['summary', 'status', 'issuetype', 'priority', 'assignee', 'labels', 'created', 'updated'],
  });
  if (searchResult.isError) throw new Error(`Search error: ${extractText(searchResult)}`);

  const searchData = JSON.parse(extractText(searchResult));
  const rawIssues = searchData?.issues ?? searchData ?? [];
  const issueKeys: string[] = [];

  for (const issue of Array.isArray(rawIssues) ? rawIssues : []) {
    if (issue.key) issueKeys.push(issue.key as string);
  }

  // Step 3: Fetch full details for each issue (with issuelinks, worklog)
  const issues: IssueDeepDiveIssue[] = [];
  let totalTimeSpentSeconds = 0;
  let totalBlocked = 0;

  for (const issueKey of issueKeys) {
    try {
      const detailResult = await callTool(rovo('getJiraIssue'), {
        cloudId,
        issueIdOrKey: issueKey,
        fields: [
          'summary', 'description', 'status', 'issuetype', 'priority',
          'assignee', 'labels', 'created', 'updated', 'issuelinks', 'worklog',
        ],
      });

      if (detailResult.isError) continue;

      const detailData = JSON.parse(extractText(detailResult));
      const fields = (detailData.fields ?? detailData) as Record<string, unknown>;

      // Parse issue links
      const rawLinks = (fields.issuelinks as Array<Record<string, unknown>>) ?? [];
      const issueLinks: IssueDeepDiveIssue['issueLinks'] = rawLinks.map((link) => {
        const linkType = link.type as Record<string, unknown> | undefined;
        const isInward = !!link.inwardIssue;
        const linkedIssue = (isInward ? link.inwardIssue : link.outwardIssue) as Record<string, unknown> | undefined;
        const linkedFields = (linkedIssue?.fields ?? {}) as Record<string, unknown>;
        return {
          type: (isInward ? linkType?.inward : linkType?.outward) as string ?? (linkType?.name as string) ?? 'Related',
          direction: isInward ? 'inward' as const : 'outward' as const,
          linkedIssueKey: (linkedIssue?.key as string) ?? '',
          linkedIssueSummary: (linkedFields.summary as string) ?? '',
          linkedIssueStatus: ((linkedFields.status as Record<string, unknown>)?.name as string) ?? 'Unknown',
        };
      });

      // Check if blocked by any link
      const isBlocked = issueLinks.some(
        (l) => l.type.toLowerCase().includes('block') && l.direction === 'inward'
      );
      if (isBlocked) totalBlocked++;

      // Parse worklog time spent
      const worklog = fields.worklog as Record<string, unknown> | undefined;
      let issueTimeSpent = 0;
      if (worklog) {
        const worklogs = (worklog.worklogs ?? []) as Array<Record<string, unknown>>;
        for (const wl of worklogs) {
          issueTimeSpent += (wl.timeSpentSeconds as number) ?? 0;
        }
      }
      totalTimeSpentSeconds += issueTimeSpent;

      // Step 4: Get remote links
      let remoteLinks: IssueDeepDiveIssue['remoteLinks'] = [];
      try {
        const remoteResult = await callTool(rovo('getJiraIssueRemoteIssueLinks'), {
          cloudId,
          issueIdOrKey: issueKey,
        });
        if (!remoteResult.isError) {
          const remoteData = JSON.parse(extractText(remoteResult));
          const rawRemoteLinks = Array.isArray(remoteData) ? remoteData : remoteData?.links ?? [];
          remoteLinks = rawRemoteLinks.map((rl: Record<string, unknown>) => {
            const obj = (rl.object ?? rl) as Record<string, unknown>;
            return {
              title: (obj.title as string) ?? (rl.title as string) ?? 'External Link',
              url: (obj.url as string) ?? (rl.url as string) ?? '',
            };
          });
        }
      } catch {
        // Remote links not available — continue
      }

      // Build description
      let description: string | undefined;
      if (typeof fields.description === 'string') {
        description = fields.description || undefined;
      } else if (fields.description && typeof fields.description === 'object') {
        description = extractAdfText(fields.description) || undefined;
      }

      issues.push({
        key: (detailData.key as string) ?? issueKey,
        summary: (fields.summary as string) ?? '',
        description,
        type: ((fields.issuetype as Record<string, unknown>)?.name as string) ?? 'Task',
        status: ((fields.status as Record<string, unknown>)?.name as string) ?? 'In Progress',
        priority: ((fields.priority as Record<string, unknown>)?.name as string) ?? undefined,
        assignee: ((fields.assignee as Record<string, unknown>)?.displayName as string) ?? undefined,
        labels: (fields.labels as string[]) ?? [],
        created: (fields.created as string) ?? undefined,
        updated: (fields.updated as string) ?? undefined,
        timeSpent: issueTimeSpent > 0 ? formatTimeSpent(issueTimeSpent) : undefined,
        issueLinks,
        remoteLinks,
      });
    } catch (err) {
      console.warn(`[issue-deep-dive] Failed to fetch details for ${issueKey}:`, err instanceof Error ? err.message : err);
    }
  }

  // Step 5: Try to get link types (jiraRead may not be available via gateway)
  let linkTypes: IssueLinkType[] = [];
  try {
    const linkTypesResult = await callTool(rovo('jiraRead'), {
      cloudId,
      action: 'getIssueLinkTypes',
    });
    if (!linkTypesResult.isError) {
      const ltData = JSON.parse(extractText(linkTypesResult));
      const rawLinkTypes = ltData?.issueLinkTypes ?? ltData ?? [];
      linkTypes = (Array.isArray(rawLinkTypes) ? rawLinkTypes : []).map(
        (lt: Record<string, unknown>) => ({
          id: String(lt.id ?? ''),
          name: (lt.name as string) ?? '',
          inward: (lt.inward as string) ?? '',
          outward: (lt.outward as string) ?? '',
        })
      );
    }
  } catch {
    // jiraRead may not be available — use common defaults
    linkTypes = [
      { id: '10000', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
      { id: '10001', name: 'Relates', inward: 'relates to', outward: 'relates to' },
      { id: '10002', name: 'Duplicate', inward: 'is duplicated by', outward: 'duplicates' },
    ];
  }

  return {
    issues,
    linkTypes,
    totalInProgress: issues.length,
    totalBlocked,
    totalTimeSpent: formatTimeSpent(totalTimeSpentSeconds),
    source: 'gateway',
  };
}

function getMockData(projectKey: string): IssueDeepDiveData {
  const isHealth = projectKey === 'HEALTH';

  const issues: IssueDeepDiveIssue[] = isHealth
    ? [
        {
          key: 'HEALTH-1',
          summary: 'Implement HIPAA-compliant patient intake flow',
          description: 'Build the core patient intake flow with HIPAA compliance. Must integrate with Epic EHR via FHIR R4 APIs. Key requirements include secure auth, PHI encryption, audit logging, and consent management.',
          type: 'Epic',
          status: 'In Progress',
          priority: 'High',
          assignee: 'Sarah Chen',
          labels: ['hipaa', 'phi', 'epic-ehr'],
          created: '2026-02-15T10:30:00.000Z',
          updated: '2026-03-15T14:22:00.000Z',
          timeSpent: '24h 30m',
          issueLinks: [
            {
              type: 'blocks',
              direction: 'outward',
              linkedIssueKey: 'HEALTH-2',
              linkedIssueSummary: 'Set up FHIR R4 API integration layer',
              linkedIssueStatus: 'To Do',
            },
            {
              type: 'relates to',
              direction: 'outward',
              linkedIssueKey: 'HEALTH-3',
              linkedIssueSummary: 'HIPAA Compliance Infrastructure',
              linkedIssueStatus: 'In Progress',
            },
          ],
          remoteLinks: [
            { title: 'Epic FHIR R4 Documentation', url: 'https://fhir.epic.com/Documentation' },
          ],
        },
        {
          key: 'HEALTH-3',
          summary: 'HIPAA compliance infrastructure setup',
          description: 'Set up compliant infrastructure including encryption at rest and in transit, audit logging for all data access, access controls, and BAA management.',
          type: 'Task',
          status: 'In Progress',
          priority: 'High',
          assignee: 'Marcus Johnson',
          labels: ['hipaa', 'infrastructure', 'compliance'],
          created: '2026-02-20T09:00:00.000Z',
          updated: '2026-03-14T11:15:00.000Z',
          timeSpent: '16h',
          issueLinks: [
            {
              type: 'is blocked by',
              direction: 'inward',
              linkedIssueKey: 'HEALTH-5',
              linkedIssueSummary: 'AWS KMS key provisioning',
              linkedIssueStatus: 'To Do',
            },
          ],
          remoteLinks: [],
        },
        {
          key: 'HEALTH-4',
          summary: 'Patient data consent management workflow',
          description: 'Implement consent collection, storage, and revocation workflow for patient data processing. Must comply with HIPAA privacy rule.',
          type: 'Story',
          status: 'In Progress',
          priority: 'Medium',
          assignee: 'Sarah Chen',
          labels: ['hipaa', 'consent', 'privacy'],
          created: '2026-02-25T14:00:00.000Z',
          updated: '2026-03-12T09:30:00.000Z',
          timeSpent: '8h 15m',
          issueLinks: [],
          remoteLinks: [
            { title: 'HIPAA Privacy Rule Guide', url: 'https://www.hhs.gov/hipaa/for-professionals/privacy' },
          ],
        },
      ]
    : [
        {
          key: 'FINSERV-1',
          summary: 'Implement document processing pipeline for loan applications',
          description: 'Build end-to-end document processing pipeline for automated loan application processing with OCR, field extraction, and compliance checks.',
          type: 'Epic',
          status: 'In Progress',
          priority: 'High',
          assignee: 'Alex Rivera',
          labels: ['pci_dss', 'document-processing', 'loan-automation'],
          created: '2026-02-20T08:00:00.000Z',
          updated: '2026-03-15T16:30:00.000Z',
          timeSpent: '32h',
          issueLinks: [
            {
              type: 'blocks',
              direction: 'outward',
              linkedIssueKey: 'FINSERV-2',
              linkedIssueSummary: 'Build SOC2-compliant audit trail',
              linkedIssueStatus: 'To Do',
            },
          ],
          remoteLinks: [
            { title: 'AWS Textract API', url: 'https://docs.aws.amazon.com/textract' },
          ],
        },
        {
          key: 'FINSERV-4',
          summary: 'PCI-DSS tokenization for payment data',
          description: 'Implement tokenization layer for payment card data in loan applications. Must use approved PCI-DSS compliant tokenization service.',
          type: 'Task',
          status: 'In Progress',
          priority: 'High',
          assignee: 'Chris Taylor',
          labels: ['pci_dss', 'tokenization', 'security'],
          created: '2026-02-28T10:00:00.000Z',
          updated: '2026-03-13T13:45:00.000Z',
          timeSpent: '12h 30m',
          issueLinks: [
            {
              type: 'is blocked by',
              direction: 'inward',
              linkedIssueKey: 'FINSERV-6',
              linkedIssueSummary: 'Vault HSM integration',
              linkedIssueStatus: 'To Do',
            },
          ],
          remoteLinks: [],
        },
        {
          key: 'FINSERV-5',
          summary: 'AI confidence scoring for document extraction',
          description: 'Implement confidence scoring for AI-extracted fields with human review triggers for low-confidence results.',
          type: 'Story',
          status: 'In Progress',
          priority: 'Medium',
          assignee: 'Alex Rivera',
          labels: ['ai', 'document-processing', 'quality'],
          created: '2026-03-01T11:00:00.000Z',
          updated: '2026-03-14T15:20:00.000Z',
          timeSpent: '6h',
          issueLinks: [],
          remoteLinks: [],
        },
      ];

  const totalBlocked = issues.filter((i) =>
    i.issueLinks.some((l) => l.type.toLowerCase().includes('block') && l.direction === 'inward')
  ).length;

  const linkTypes: IssueLinkType[] = [
    { id: '10000', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
    { id: '10001', name: 'Relates', inward: 'relates to', outward: 'relates to' },
    { id: '10002', name: 'Duplicate', inward: 'is duplicated by', outward: 'duplicates' },
  ];

  return {
    issues,
    linkTypes,
    totalInProgress: issues.length,
    totalBlocked,
    totalTimeSpent: isHealth ? '48h 45m' : '50h 30m',
    source: 'mock',
  };
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = ProjectKeySchema.safeParse(body.projectKey);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid project key format' }, { status: 400 });
    }
    const projectKey = parsed.data;

    let data: IssueDeepDiveData;

    if (isConfigured()) {
      try {
        data = await fetchViaGateway(projectKey);
      } catch (err) {
        console.warn(
          '[issue-deep-dive] Gateway failed, using mock:',
          err instanceof Error ? err.message : err
        );
        data = getMockData(projectKey);
      }
    } else {
      data = getMockData(projectKey);
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
