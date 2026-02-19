import { NextResponse } from 'next/server';
import { GenerateArchitectureInputSchema } from 'partner-enablement-mcp-server/schemas';
import { knowledgeBase } from '../_shared';
import { rateLimit } from '../_rateLimit';

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = GenerateArchitectureInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { projectContext, includeAlternatives, includeDiagram, focusAreas } = parsed.data;

    // Recommend pattern based on use case
    const recommendedPatternId = knowledgeBase.recommendPattern(
      projectContext.useCaseDescription,
      projectContext.complianceTags || []
    );

    const pattern = knowledgeBase.getArchitecturePattern(recommendedPatternId);
    if (!pattern) {
      return NextResponse.json(
        { error: `Pattern '${recommendedPatternId}' not found` },
        { status: 500 }
      );
    }

    // Get cloud-specific services
    const cloudProvider = projectContext.cloudProvider || 'aws';
    const components = Object.entries(pattern.components).map(([key, comp]) => ({
      name: key,
      description: comp.description,
      services: {
        [cloudProvider]:
          comp.services[cloudProvider as keyof typeof comp.services] || [],
        anthropic: comp.services.anthropic || [],
      },
      considerations: [] as string[],
    }));

    // Add compliance-specific considerations
    const complianceFrameworks: string[] = projectContext.complianceTags || [];
    for (const framework of complianceFrameworks) {
      const frameworkData = knowledgeBase.getComplianceFramework(framework);
      if (frameworkData) {
        for (const comp of components) {
          const implications =
            frameworkData.architectureImplications[comp.name];
          if (implications && 'implementation' in implications) {
            comp.considerations.push(...implications.implementation);
          }
        }
      }
    }

    // Phase 6.5: Sort components to prioritize focusAreas
    const areas = focusAreas || [];
    if (areas.length > 0) {
      const focusLower = areas.map(f => f.toLowerCase());
      components.sort((a, b) => {
        const aMatch = focusLower.some(f => a.name.toLowerCase().includes(f) || a.description.toLowerCase().includes(f));
        const bMatch = focusLower.some(f => b.name.toLowerCase().includes(f) || b.description.toLowerCase().includes(f));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
    }

    // Phase 6.4: Only append ellipsis when description exceeds 100 chars
    const desc = projectContext.useCaseDescription;
    const truncatedDesc = desc.length > 100 ? `${desc.substring(0, 100)}...` : desc;
    let rationaleStr = `Based on the use case "${truncatedDesc}", the ${pattern.name} pattern is recommended because it ${pattern.useCases[0]?.toLowerCase() || 'fits your requirements'}.`;
    if (areas.length > 0) {
      rationaleStr += ` Focus areas: ${areas.join(', ')}.`;
    }

    const output = {
      pattern: recommendedPatternId,
      patternName: pattern.name,
      rationale: rationaleStr,
      components,
      dataFlow: pattern.dataFlow,
      mermaidDiagram: includeDiagram ? pattern.mermaidDiagram : undefined,
      securityConsiderations: [
        ...pattern.securityConsiderations,
        ...(complianceFrameworks.includes('hipaa')
          ? [
              'BAA required with Claude API provider',
              'PHI must be encrypted at rest and in transit',
              'Comprehensive audit logging required for all PHI access',
            ]
          : []),
      ],
      scalingConsiderations: pattern.scalingConsiderations || [],
      alternatives: includeAlternatives
        ? Object.entries(knowledgeBase.getAllPatterns())
            .filter(([id]) => id !== recommendedPatternId)
            .slice(0, 2)
            .map(([id, p]) => ({
              pattern: id,
              rationale: `Consider if ${p.useCases[0]}`,
            }))
        : undefined,
    };

    return NextResponse.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
