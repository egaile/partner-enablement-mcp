import { NextResponse } from 'next/server';
import { AssessComplianceInputSchema } from 'partner-enablement-mcp-server/schemas';
import { knowledgeBase, ROVO_SERVER_NAME } from '../_shared';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { rateLimit } from '../_rateLimit';

interface ComplianceDocCoverage {
  framework: string;
  existingDocs: Array<{ title: string; excerpt: string; spaceKey?: string; url?: string }>;
  coverage: 'full' | 'partial' | 'missing';
}

function rovo(toolName: string): string {
  return `${ROVO_SERVER_NAME}__${toolName}`;
}

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

/**
 * Search Confluence for compliance docs per framework.
 */
async function fetchComplianceDocs(cloudId: string, frameworks: string[]): Promise<ComplianceDocCoverage[]> {
  const coverage: ComplianceDocCoverage[] = [];

  for (const framework of frameworks) {
    const frameworkName = framework.replace(/_/g, '-').toUpperCase();
    // Build CQL with separate text ~ clauses joined by OR
    const searchTermGroups: string[] = framework === 'hipaa'
      ? ['HIPAA', 'PHI', 'protected health']
      : framework === 'soc2' ? ['SOC2', 'SOC 2', 'trust services']
      : framework === 'pci_dss' ? ['PCI-DSS', 'PCI DSS', 'payment card']
      : framework === 'fedramp' ? ['FedRAMP', 'federal risk']
      : framework === 'gdpr' ? ['GDPR', 'data protection']
      : [frameworkName, 'compliance'];

    const textClauses = searchTermGroups.map((t) => `text ~ "${t}"`).join(' OR ');

    try {
      const searchResult = await callTool(rovo('searchConfluenceUsingCql'), {
        cloudId,
        cql: `type = page AND (${textClauses})`,
        limit: 3,
      });

      if (searchResult.isError) {
        coverage.push({ framework, existingDocs: [], coverage: 'missing' });
        continue;
      }

      const searchText = extractText(searchResult);
      const searchData = JSON.parse(searchText);
      const results = searchData?.results ?? searchData ?? [];

      if (!Array.isArray(results) || results.length === 0) {
        coverage.push({ framework, existingDocs: [], coverage: 'missing' });
        continue;
      }

      const docs = results.slice(0, 3).map((r: Record<string, unknown>) => {
        const content = r.content as Record<string, unknown> | undefined;
        return {
          title: (content?.title ?? r.title ?? 'Untitled') as string,
          excerpt: ((r.excerpt ?? '') as string).replace(/<\/?[^>]+(>|$)/g, '').substring(0, 200),
          spaceKey: ((content?.space as Record<string, unknown>)?.key ?? '') as string,
        };
      });

      coverage.push({
        framework,
        existingDocs: docs,
        coverage: docs.length >= 2 ? 'full' : 'partial',
      });
    } catch {
      coverage.push({ framework, existingDocs: [], coverage: 'missing' });
    }
  }

  return coverage;
}

/**
 * Mock compliance doc coverage for when gateway is unavailable.
 */
function getMockComplianceDocs(frameworks: string[], projectKey: string): ComplianceDocCoverage[] {
  const isHealthcare = projectKey === 'HEALTH' || projectKey.toLowerCase().includes('health');
  return frameworks.map((fw) => {
    if (fw === 'hipaa' && isHealthcare) {
      return {
        framework: fw,
        existingDocs: [
          { title: 'HIPAA Compliance Policy', excerpt: 'PHI handling procedures, BAA requirements, audit controls, encryption standards, access control matrix.', spaceKey: 'HAI' },
          { title: 'PHI Data Classification Guide', excerpt: 'Data classification tiers, handling rules per tier, AI/ML pipeline considerations for PHI.', spaceKey: 'HAI' },
        ],
        coverage: 'full' as const,
      };
    }
    if (fw === 'soc2' && !isHealthcare) {
      return {
        framework: fw,
        existingDocs: [
          { title: 'SOC2 Type II Control Matrix', excerpt: 'Control objectives, evidence requirements, continuous monitoring, AI-specific controls.', spaceKey: 'FSAI' },
        ],
        coverage: 'partial' as const,
      };
    }
    if (fw === 'pci_dss' && !isHealthcare) {
      return {
        framework: fw,
        existingDocs: [
          { title: 'PCI-DSS Compliance Runbook', excerpt: 'Tokenization procedures, key management, network segmentation for AI workloads.', spaceKey: 'FSAI' },
        ],
        coverage: 'partial' as const,
      };
    }
    return { framework: fw, existingDocs: [], coverage: 'missing' as const };
  });
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = AssessComplianceInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { projectContext, detailLevel, includeChecklist } = parsed.data;

    // Determine applicable frameworks
    const applicableFrameworks = knowledgeBase.getApplicableFrameworks(
      projectContext.industry,
      projectContext.dataTypes || []
    );

    // Get framework details
    const frameworkDetails = applicableFrameworks.map((fwId) => {
      const fw = knowledgeBase.getComplianceFramework(fwId);
      return {
        framework: fwId,
        name: fw?.name || fwId.toUpperCase(),
        applicabilityReason:
          fw?.applicableWhen?.[0] || 'Based on project industry',
        priority: projectContext.complianceTags?.includes(fwId as "hipaa" | "soc2" | "fedramp" | "pci_dss" | "gdpr" | "ccpa")
          ? ('required' as const)
          : ('recommended' as const),
      };
    });

    // Get detailed requirements
    const requirements = knowledgeBase.getComplianceRequirements(
      applicableFrameworks
    );

    // Identify risk areas
    const riskAreas: Array<{
      area: string;
      risk: string;
      mitigation: string;
    }> = [];

    if (applicableFrameworks.includes('hipaa')) {
      riskAreas.push({
        area: 'PHI in LLM Prompts',
        risk: 'Protected Health Information may be included in prompts sent to Claude API',
        mitigation:
          'Ensure BAA is in place with Anthropic; implement PHI detection and masking where appropriate',
      });
      riskAreas.push({
        area: 'Conversation Logging',
        risk: 'Chat logs containing PHI require same protections as other PHI',
        mitigation:
          'Encrypt conversation storage; implement access controls; define retention policies',
      });
    }

    if (applicableFrameworks.includes('pci_dss') || applicableFrameworks.includes('soc2')) {
      riskAreas.push({
        area: 'Customer Data in LLM Context',
        risk: 'Sensitive financial or personal data may be included in prompts',
        mitigation:
          'Implement data classification; mask sensitive fields before LLM processing; maintain audit trail',
      });
    }

    if (
      projectContext.integrationTargets?.some(
        (t: string) =>
          t.toLowerCase().includes('ehr') || t.toLowerCase().includes('epic')
      )
    ) {
      riskAreas.push({
        area: 'EHR Integration',
        risk: 'Integration with EHR systems expands attack surface and compliance scope',
        mitigation:
          'Follow vendor security guidelines; implement API access controls; audit all data access',
      });
    }

    // Build checklist
    const checklist = includeChecklist
      ? [
          { item: 'BAA executed with LLM provider', category: 'Legal', completed: false },
          { item: 'Data encryption at rest configured', category: 'Technical', completed: false },
          { item: 'Data encryption in transit (TLS 1.2+)', category: 'Technical', completed: false },
          { item: 'Audit logging implemented', category: 'Technical', completed: false },
          { item: 'Access controls and RBAC configured', category: 'Technical', completed: false },
          { item: 'Security risk assessment completed', category: 'Administrative', completed: false },
          { item: 'Incident response plan documented', category: 'Administrative', completed: false },
          { item: 'Staff training completed', category: 'Administrative', completed: false },
          { item: 'Data retention policy defined', category: 'Administrative', completed: false },
          { item: 'Penetration testing scheduled', category: 'Technical', completed: false },
        ]
      : undefined;

    // Fetch compliance doc coverage from Confluence
    let documentCoverage: ComplianceDocCoverage[] = [];
    if (isConfigured()) {
      try {
        const resourcesResult = await callTool(rovo('getAccessibleAtlassianResources'), {});
        if (!resourcesResult.isError) {
          const resourcesText = extractText(resourcesResult);
          const resources = JSON.parse(resourcesText);
          const cloudId: string = Array.isArray(resources) ? resources[0]?.id : resources?.id;
          if (cloudId) {
            documentCoverage = await fetchComplianceDocs(cloudId, applicableFrameworks);
          }
        }
      } catch (err) {
        console.warn('[assess-compliance] Confluence search failed, using mock:', err instanceof Error ? err.message : err);
        resetSession();
        documentCoverage = getMockComplianceDocs(applicableFrameworks, projectContext.projectKey);
      }
    } else {
      documentCoverage = getMockComplianceDocs(applicableFrameworks, projectContext.projectKey);
    }

    const output = {
      applicableFrameworks: frameworkDetails,
      keyRequirements:
        detailLevel !== 'summary'
          ? requirements.map((r) => ({
              ...r,
              priority: r.priority as 'critical' | 'high' | 'medium' | 'low',
            }))
          : [],
      riskAreas,
      checklist,
      documentCoverage,
    };

    return NextResponse.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
