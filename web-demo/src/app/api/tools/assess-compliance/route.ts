import { NextResponse } from 'next/server';
import { AssessComplianceInputSchema } from 'partner-enablement-mcp-server/schemas';
import { knowledgeBase } from '../_shared';
import { rateLimit } from '../_rateLimit';

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
    };

    return NextResponse.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
