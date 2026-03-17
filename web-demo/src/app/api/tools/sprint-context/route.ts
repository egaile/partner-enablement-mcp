import { NextResponse } from 'next/server';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ROVO_SERVER_NAME, ProjectKeySchema } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { ProjectMeta, SprintContextData } from '@/types/api';

function rovo(toolName: string): string {
  return `${ROVO_SERVER_NAME}__${toolName}`;
}

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.find((c) => c.type === 'text')?.text ?? '';
}

const CLOUD_ID = '7c2ac73e-d0b6-4fa3-8059-3d5aa405c0e1';

async function fetchViaGateway(projectKey: string): Promise<SprintContextData> {
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

  // Step 2: Get visible projects — search for the requested key
  const projectsResult = await callTool(rovo('getVisibleJiraProjects'), {
    cloudId,
    searchString: projectKey,
    maxResults: 10,
  });
  if (projectsResult.isError) throw new Error(`Tool error: ${extractText(projectsResult)}`);

  const projectsData = JSON.parse(extractText(projectsResult));
  const projectsList = projectsData?.values ?? projectsData ?? [];
  const allProjects: ProjectMeta[] = [];

  for (const p of Array.isArray(projectsList) ? projectsList : []) {
    const pKey = (p.key as string) ?? '';
    const pName = (p.name as string) ?? pKey;
    const pDesc = (p.description as string) ?? undefined;
    const pLead = (p.lead?.displayName as string) ?? undefined;

    // Step 3: Get issue types for each project
    let issueTypes: ProjectMeta['issueTypes'] = [];
    try {
      const itResult = await callTool(rovo('getJiraProjectIssueTypesMetadata'), {
        cloudId,
        projectIdOrKey: pKey,
      });
      if (!itResult.isError) {
        const itData = JSON.parse(extractText(itResult));
        const rawTypes = itData?.issueTypes ?? itData?.values ?? itData ?? [];
        issueTypes = (Array.isArray(rawTypes) ? rawTypes : []).map(
          (t: Record<string, unknown>) => ({
            id: String(t.id ?? ''),
            name: (t.name as string) ?? 'Unknown',
            description: (t.description as string) ?? undefined,
          })
        );
      }
    } catch {
      // Issue types not available — continue with empty array
    }

    // Step 4: Get field schemas for the first issue type
    let fieldSchemas: ProjectMeta['fieldSchemas'] = [];
    if (issueTypes.length > 0) {
      try {
        const fResult = await callTool(rovo('getJiraIssueTypeMetaWithFields'), {
          cloudId,
          projectIdOrKey: pKey,
          issueTypeId: issueTypes[0].id,
        });
        if (!fResult.isError) {
          const fData = JSON.parse(extractText(fResult));
          const rawFields = fData?.fields ?? fData?.values ?? fData ?? {};

          // fields may be an object keyed by fieldId or an array
          if (Array.isArray(rawFields)) {
            fieldSchemas = rawFields.map((f: Record<string, unknown>) => ({
              fieldId: (f.fieldId as string) ?? (f.key as string) ?? '',
              name: (f.name as string) ?? '',
              type: ((f.schema as Record<string, unknown>)?.type as string) ?? (f.type as string) ?? 'string',
              required: (f.required as boolean) ?? false,
            }));
          } else if (typeof rawFields === 'object') {
            fieldSchemas = Object.entries(rawFields as Record<string, unknown>).map(
              ([fieldId, val]) => {
                const f = val as Record<string, unknown>;
                return {
                  fieldId,
                  name: (f.name as string) ?? fieldId,
                  type: ((f.schema as Record<string, unknown>)?.type as string) ?? (f.type as string) ?? 'string',
                  required: (f.required as boolean) ?? false,
                };
              }
            );
          }
        }
      } catch {
        // Field schemas not available — continue with empty array
      }
    }

    allProjects.push({
      key: pKey,
      name: pName,
      description: pDesc,
      lead: pLead,
      issueTypes,
      fieldSchemas,
    });
  }

  // Find the selected project
  const selected = allProjects.find((p) => p.key === projectKey) ?? allProjects[0];
  if (!selected) {
    throw new Error(`Project ${projectKey} not found`);
  }

  return {
    projects: allProjects,
    selectedProject: selected,
    source: 'gateway',
  };
}

function getMockData(projectKey: string): SprintContextData {
  const commonFields: ProjectMeta['fieldSchemas'] = [
    { fieldId: 'summary', name: 'Summary', type: 'string', required: true },
    { fieldId: 'description', name: 'Description', type: 'string', required: false },
    { fieldId: 'status', name: 'Status', type: 'status', required: false },
    { fieldId: 'priority', name: 'Priority', type: 'priority', required: false },
    { fieldId: 'assignee', name: 'Assignee', type: 'user', required: false },
    { fieldId: 'labels', name: 'Labels', type: 'array', required: false },
  ];

  const commonIssueTypes: ProjectMeta['issueTypes'] = [
    { id: '10000', name: 'Epic', description: 'A large body of work broken into stories' },
    { id: '10001', name: 'Story', description: 'A user story representing a feature' },
    { id: '10002', name: 'Task', description: 'A task to be completed' },
    { id: '10003', name: 'Bug', description: 'A defect or issue to fix' },
  ];

  const healthProject: ProjectMeta = {
    key: 'HEALTH',
    name: 'Healthcare AI Deployment',
    description: 'HIPAA-compliant healthcare AI platform with Epic EHR integration',
    lead: 'Ed Gaile',
    issueTypes: commonIssueTypes,
    fieldSchemas: commonFields,
  };

  const finservProject: ProjectMeta = {
    key: 'FINSERV',
    name: 'Financial Services AI',
    description: 'AI-powered document processing for loan applications with SOC2/PCI-DSS compliance',
    lead: 'Ed Gaile',
    issueTypes: commonIssueTypes,
    fieldSchemas: commonFields,
  };

  const projects = [healthProject, finservProject];
  const selected = projects.find((p) => p.key === projectKey) ?? healthProject;

  return {
    projects,
    selectedProject: selected,
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

    let data: SprintContextData;

    if (isConfigured()) {
      try {
        data = await fetchViaGateway(projectKey);
      } catch (err) {
        console.warn(
          '[sprint-context] Gateway failed, using mock:',
          err instanceof Error ? err.message : err
        );
        resetSession();
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
