import { NextResponse } from 'next/server';
import { MockJiraClient } from 'partner-enablement-mcp-server/services/jiraClient';
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

export interface HealthData {
  readinessScore: number;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  openCount: number;
  highPriorityCount: number;
  overdueCount: number;
  blockedCount: number;
  riskFlags: string[];
  source: 'gateway' | 'mock';
}

function computeReadiness(overdue: number, blocked: number, critical: number): number {
  const score = 100 - (overdue * 10) - (blocked * 15) - (critical * 5);
  return Math.max(0, Math.min(100, score));
}

function buildRiskFlags(overdue: number, blocked: number, critical: number): string[] {
  const flags: string[] = [];
  if (critical > 0) flags.push(`${critical} critical issue${critical > 1 ? 's' : ''} need immediate attention`);
  if (overdue > 0) flags.push(`${overdue} issue${overdue > 1 ? 's' : ''} past due date`);
  if (blocked > 0) flags.push(`${blocked} blocked issue${blocked > 1 ? 's' : ''} stalling progress`);
  if (overdue > 3) flags.push('High overdue count suggests scope or resource issues');
  if (blocked > 2) flags.push('Multiple blockers may indicate dependency bottleneck');
  return flags;
}

const mockFallback = new MockJiraClient();

async function fetchViaGateway(projectKey: string): Promise<HealthData> {
  // Step 1: Get cloudId
  const resourcesResult = await callTool(rovo('getAccessibleAtlassianResources'), {});
  if (resourcesResult.isError) throw new Error(`Tool error: ${extractText(resourcesResult)}`);
  const resources = JSON.parse(extractText(resourcesResult));
  const cloudId: string = Array.isArray(resources) ? resources[0]?.id : resources?.id;
  if (!cloudId) throw new Error('No Atlassian cloud resources found');

  // Step 2: Run 4 JQL queries in parallel
  const queries = [
    `project = ${projectKey} AND status != Done ORDER BY created DESC`,
    `project = ${projectKey} AND priority in (Critical, Highest, High) AND status != Done ORDER BY priority ASC`,
    `project = ${projectKey} AND duedate < now() AND status != Done ORDER BY duedate ASC`,
    `project = ${projectKey} AND status = Blocked ORDER BY created DESC`,
  ];

  const results = await Promise.all(
    queries.map((jql) =>
      callTool(rovo('searchJiraIssuesUsingJql'), {
        cloudId,
        jql,
        maxResults: 50,
        fields: ['summary', 'status', 'priority', 'issuetype', 'duedate'],
      }).catch(() => ({ content: [{ type: 'text', text: '{"issues":[]}' }], isError: false }))
    )
  );

  const parseIssues = (result: { content: Array<{ type: string; text?: string }>; isError?: boolean }) => {
    if (result.isError) return [];
    const text = extractText(result);
    try {
      const data = JSON.parse(text);
      return Array.isArray(data?.issues) ? data.issues : Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  const openIssues = parseIssues(results[0]);
  const highPriority = parseIssues(results[1]);
  const overdue = parseIssues(results[2]);
  const blocked = parseIssues(results[3]);

  // Build status/priority breakdowns from open issues
  const statusBreakdown: Record<string, number> = {};
  const priorityBreakdown: Record<string, number> = {};

  for (const issue of openIssues) {
    const fields = (issue.fields ?? issue) as Record<string, unknown>;
    const status = ((fields.status as Record<string, unknown>)?.name as string) ?? (fields.status as string) ?? 'Unknown';
    const priority = ((fields.priority as Record<string, unknown>)?.name as string) ?? 'Medium';
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;
  }

  const criticalCount = (priorityBreakdown['Critical'] || 0) + (priorityBreakdown['Highest'] || 0);

  return {
    readinessScore: computeReadiness(overdue.length, blocked.length, criticalCount),
    statusBreakdown,
    priorityBreakdown,
    openCount: openIssues.length,
    highPriorityCount: highPriority.length,
    overdueCount: overdue.length,
    blockedCount: blocked.length,
    riskFlags: buildRiskFlags(overdue.length, blocked.length, criticalCount),
    source: 'gateway',
  };
}

async function fetchViaMock(projectKey: string): Promise<HealthData> {
  const searchResult = await mockFallback.searchIssues(projectKey, { maxResults: 50 });
  const issues = searchResult.issues;

  const statusBreakdown: Record<string, number> = {};
  const priorityBreakdown: Record<string, number> = {};
  let overdueCount = 0;
  let blockedCount = 0;
  let openCount = 0;
  let highPriorityCount = 0;

  for (const issue of issues) {
    const status = issue.fields.status.name;
    const priority = issue.fields.priority?.name ?? 'Medium';

    if (status !== 'Done') {
      openCount++;
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;

      if (['Critical', 'Highest', 'High'].includes(priority)) {
        highPriorityCount++;
      }
      if (status === 'Blocked') {
        blockedCount++;
      }
    }
  }

  // Simulate some overdue items for demo
  overdueCount = Math.min(2, Math.floor(openCount * 0.2));
  const criticalCount = (priorityBreakdown['Critical'] || 0) + (priorityBreakdown['Highest'] || 0);

  return {
    readinessScore: computeReadiness(overdueCount, blockedCount, criticalCount),
    statusBreakdown,
    priorityBreakdown,
    openCount,
    highPriorityCount,
    overdueCount,
    blockedCount,
    riskFlags: buildRiskFlags(overdueCount, blockedCount, criticalCount),
    source: 'mock',
  };
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const projectKey = (body.projectKey as string) ?? 'HEALTH';

    let healthData: HealthData;

    if (isConfigured()) {
      try {
        healthData = await fetchViaGateway(projectKey);
      } catch (err) {
        console.warn('[project-health] Gateway failed, using mock:', err instanceof Error ? err.message : err);
        resetSession();
        healthData = await fetchViaMock(projectKey);
      }
    } else {
      healthData = await fetchViaMock(projectKey);
    }

    return NextResponse.json(healthData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
