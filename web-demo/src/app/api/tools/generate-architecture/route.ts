import { NextResponse } from 'next/server';
import { knowledgeBase } from '../_shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      projectContext,
      includeAlternatives = false,
      includeDiagram = true,
    } = body;

    if (!projectContext?.useCaseDescription) {
      return NextResponse.json(
        { error: 'projectContext with useCaseDescription is required' },
        { status: 400 }
      );
    }

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

    const output = {
      pattern: recommendedPatternId,
      patternName: pattern.name,
      rationale: `Based on the use case "${projectContext.useCaseDescription.substring(0, 100)}...", the ${pattern.name} pattern is recommended because it ${pattern.useCases[0]?.toLowerCase() || 'fits your requirements'}.`,
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
