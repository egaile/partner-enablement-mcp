import { NextResponse } from 'next/server';
import { ReadProjectContextInputSchema } from 'partner-enablement-mcp-server/schemas';
import { MockJiraClient } from 'partner-enablement-mcp-server/services/jiraClient';
import { jiraClient } from '../_shared';
import { rateLimit } from '../_rateLimit';

const mockFallback = new MockJiraClient();

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

    // Get project details — fall back to mock data if live Jira fails
    let project;
    let client = jiraClient;
    try {
      project = await jiraClient.getProject(projectKey);
    } catch {
      console.warn(`Live Jira failed for ${projectKey}, falling back to mock data`);
      client = mockFallback;
      project = await mockFallback.getProject(projectKey);
    }

    // Get recent issues
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
      const searchResult = await client.searchIssues(projectKey, {
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
    if (descriptionText.includes('pii') || descriptionText.includes('personal') || allLabels.has('customer-data')) {
      dataTypes.push('PII');
    }
    if (allLabels.has('pci_dss') || allLabels.has('payment') || descriptionText.includes('financial')) {
      dataTypes.push('financial');
    }

    const output = {
      project: {
        key: project.key,
        name: project.name,
        description: project.description,
        lead: project.lead?.displayName,
      },
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
