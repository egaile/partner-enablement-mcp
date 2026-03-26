import { NextResponse } from 'next/server';
import { ReadProjectContextInputSchema } from 'partner-enablement-mcp-server/schemas';
import { MockJiraClient } from 'partner-enablement-mcp-server/services/jiraClient';
import { callTool, isConfigured } from '@/lib/gateway-client';
import { ROVO_SERVER_NAME, safeJsonParse } from '../_shared';
import { rateLimit } from '../_rateLimit';

const mockFallback = new MockJiraClient();

/** Prefix a Rovo tool name with the configured server name */
function rovo(toolName: string): string {
  return `${ROVO_SERVER_NAME}__${toolName}`;
}

/** Extract the first text content block from an MCP tool result */
function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

/**
 * Fetch project context via the gateway → Rovo MCP Server → Jira Cloud.
 * Returns data in the same shape as the direct JiraClient path.
 */
async function fetchViaGateway(projectKey: string, includeIssues: boolean, issueLimit: number) {
  // Step 1: Get cloudId
  const resourcesResult = await callTool(rovo('getAccessibleAtlassianResources'), {});
  if (resourcesResult.isError) {
    throw new Error(`Tool error: ${extractText(resourcesResult)}`);
  }
  const resourcesText = extractText(resourcesResult);
  // Response is JSON — may be an array or wrapped object
  const resources = safeJsonParse(resourcesText) as Record<string, unknown> | unknown[] | null;
  if (!resources) throw new Error('Failed to parse Atlassian resources response');
  // Rovo returns: array of { id, url, name, ... } where id is the cloudId
  const cloudId: string = Array.isArray(resources) ? (resources[0] as Record<string, unknown>)?.id as string : (resources as Record<string, unknown>)?.id as string;
  if (!cloudId) {
    throw new Error('No Atlassian cloud resources found');
  }

  // Step 2: Get project info
  const projectsResult = await callTool(rovo('getVisibleJiraProjects'), {
    cloudId,
    searchString: projectKey,
    maxResults: 1,
  });
  if (projectsResult.isError) {
    throw new Error(`Tool error: ${extractText(projectsResult)}`);
  }
  const projectsText = extractText(projectsResult);
  const projectsData = safeJsonParse(projectsText) as Record<string, unknown> | null;
  if (!projectsData) throw new Error('Failed to parse projects response');
  // projectsData.values is the array of projects
  const projects = projectsData?.values ?? projectsData ?? [];
  const projectInfo = Array.isArray(projects)
    ? projects.find((p: Record<string, unknown>) => p.key === projectKey)
    : null;

  const project = {
    key: projectKey,
    name: (projectInfo?.name as string) ?? projectKey,
    description: (projectInfo?.description as string) ?? '',
    lead: (projectInfo?.lead?.displayName as string) ?? undefined,
  };

  // Step 3: Search issues
  let issues: Array<{
    key: string;
    summary: string;
    description?: string;
    type: string;
    status: string;
    labels: string[];
    priority?: string;
  }> = [];

  if (includeIssues) {
    const jql = `project = ${projectKey} ORDER BY created DESC`;
    const searchResult = await callTool(rovo('searchJiraIssuesUsingJql'), {
      cloudId,
      jql,
      maxResults: issueLimit,
      fields: ['summary', 'description', 'status', 'issuetype', 'priority', 'labels'],
    });
    if (searchResult.isError) {
      throw new Error(`Tool error: ${extractText(searchResult)}`);
    }
    const searchText = extractText(searchResult);
    const searchData = safeJsonParse(searchText) as Record<string, unknown> | null;
    if (!searchData) throw new Error('Failed to parse search response');
    const rawIssues = searchData?.issues ?? searchData ?? [];

    issues = (Array.isArray(rawIssues) ? rawIssues : []).map(
      (issue: Record<string, unknown>) => {
        const fields = (issue.fields ?? issue) as Record<string, unknown>;
        return {
          key: (issue.key as string) ?? '',
          summary: (fields.summary as string) ?? '',
          description: (fields.description as string) || undefined,
          type:
            ((fields.issuetype as Record<string, unknown>)?.name as string) ??
            (fields.issuetype as string) ??
            'Unknown',
          status:
            ((fields.status as Record<string, unknown>)?.name as string) ??
            (fields.status as string) ??
            'Unknown',
          labels: (fields.labels as string[]) ?? [],
          priority:
            ((fields.priority as Record<string, unknown>)?.name as string) ?? undefined,
        };
      }
    );
  }

  return { project, issues };
}

/**
 * Fall back to MockJiraClient for project context.
 */
async function fetchViaMock(projectKey: string, includeIssues: boolean, issueLimit: number) {
  const project = await mockFallback.getProject(projectKey);

  let issues: Array<{
    key: string;
    summary: string;
    description?: string;
    type: string;
    status: string;
    labels: string[];
    priority?: string;
  }> = [];

  if (includeIssues) {
    const searchResult = await mockFallback.searchIssues(projectKey, {
      maxResults: issueLimit,
    });
    issues = searchResult.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description || undefined,
      type: issue.fields.issuetype.name,
      status: issue.fields.status.name,
      labels: issue.fields.labels,
      priority: issue.fields.priority?.name,
    }));
  }

  return {
    project: {
      key: project.key,
      name: project.name,
      description: project.description ?? '',
      lead: project.lead?.displayName,
    },
    issues,
  };
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = ReadProjectContextInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { projectKey, includeIssues, issueLimit } = parsed.data;

    // Try gateway → Rovo path first, fall back to mock
    let project: { key: string; name: string; description: string; lead?: string };
    let issues: Array<{
      key: string;
      summary: string;
      description?: string;
      type: string;
      status: string;
      labels: string[];
      priority?: string;
    }>;

    if (isConfigured()) {
      try {
        const result = await fetchViaGateway(projectKey, includeIssues ?? true, issueLimit ?? 20);
        project = result.project;
        issues = result.issues;
      } catch (err) {
        console.warn(
          `[read-context] Gateway/Rovo failed for ${projectKey}, falling back to mock:`,
          err instanceof Error ? err.message : err
        );
        const result = await fetchViaMock(projectKey, includeIssues ?? true, issueLimit ?? 20);
        project = result.project;
        issues = result.issues;
      }
    } else {
      const result = await fetchViaMock(projectKey, includeIssues ?? true, issueLimit ?? 20);
      project = result.project;
      issues = result.issues;
    }

    // Extract compliance indicators from labels
    const allLabels = new Set<string>();
    for (const issue of issues) {
      for (const label of issue.labels) {
        allLabels.add(label.toLowerCase());
      }
    }

    const complianceIndicators: string[] = [];
    if (allLabels.has('hipaa') || allLabels.has('phi')) {
      complianceIndicators.push('HIPAA compliance required');
    }
    if (allLabels.has('pci') || allLabels.has('pci_dss') || allLabels.has('payment')) {
      complianceIndicators.push('PCI-DSS compliance may be required');
    }
    if (allLabels.has('soc2')) {
      complianceIndicators.push('SOC2 compliance required');
    }

    // Detect integration targets
    const integrationTargets: string[] = [];
    const descriptionText = issues
      .map((i) => `${i.summary} ${i.description || ''}`)
      .join(' ')
      .toLowerCase();

    if (descriptionText.includes('epic') || descriptionText.includes('ehr')) {
      integrationTargets.push('Epic EHR');
    }
    if (descriptionText.includes('cerner')) {
      integrationTargets.push('Cerner EHR');
    }
    if (descriptionText.includes('fhir')) {
      integrationTargets.push('FHIR APIs');
    }
    if (descriptionText.includes('salesforce')) {
      integrationTargets.push('Salesforce');
    }
    if (descriptionText.includes('banking') || descriptionText.includes('core banking')) {
      integrationTargets.push('Core Banking APIs');
    }

    // Detect data types from labels and descriptions
    const dataTypes: string[] = [];
    if (allLabels.has('phi') || allLabels.has('hipaa')) {
      dataTypes.push('PHI');
    }
    if (
      descriptionText.includes('pii') ||
      descriptionText.includes('personal') ||
      allLabels.has('customer-data')
    ) {
      dataTypes.push('PII');
    }
    if (
      allLabels.has('pci_dss') ||
      allLabels.has('payment') ||
      descriptionText.includes('financial')
    ) {
      dataTypes.push('financial');
    }

    const output = {
      project,
      issues,
      detectedCompliance: complianceIndicators,
      detectedIntegrations: integrationTargets,
      detectedDataTypes: dataTypes,
      allLabels: Array.from(allLabels).sort(),
      summary: {
        totalIssues: issues.length,
        byType: issues.reduce(
          (acc, i) => {
            acc[i.type] = (acc[i.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        byStatus: issues.reduce(
          (acc, i) => {
            acc[i.status] = (acc[i.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    };

    return NextResponse.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
