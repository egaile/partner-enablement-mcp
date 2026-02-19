import { NextResponse } from 'next/server';
import { CreateImplementationPlanInputSchema } from 'partner-enablement-mcp-server/schemas';
import { knowledgeBase } from '../_shared';
import { rateLimit } from '../_rateLimit';

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = CreateImplementationPlanInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const {
      projectContext,
      architecturePattern,
      teamSize,
      timelineWeeks,
      includeJiraTickets,
      sprintLengthWeeks,
    } = parsed.data;

    // Get pattern for timeline estimation
    const pattern = knowledgeBase.getArchitecturePattern(architecturePattern);
    const matchedUseCase = knowledgeBase.matchUseCase(
      projectContext.industry,
      projectContext.useCaseDescription
    );

    // Estimate timeline if not provided
    let totalWeeks = timelineWeeks;
    if (!totalWeeks) {
      const complexityWeeks: Record<string, number> = {
        low: 8,
        medium: 14,
        high: 22,
      };
      totalWeeks =
        complexityWeeks[matchedUseCase?.estimatedComplexity || 'medium'];
    }

    const totalSprints = Math.ceil(totalWeeks / sprintLengthWeeks);

    // Define phases — assign last phase as remainder to avoid ceiling overshoot
    const discoveryWeeks = Math.ceil(totalWeeks * 0.2);
    const foundationWeeks = Math.ceil(totalWeeks * 0.25);
    const coreDevWeeks = Math.ceil(totalWeeks * 0.35);
    const testingWeeks = Math.max(1, totalWeeks - discoveryWeeks - foundationWeeks - coreDevWeeks);

    const phases = [
      {
        name: 'Discovery & Design',
        description:
          'Requirements gathering, architecture design, compliance planning',
        durationWeeks: discoveryWeeks,
        sprints: [] as Array<{
          number: number;
          focus: string;
          deliverables: string[];
        }>,
        milestones: [
          'Architecture design approved',
          'Compliance requirements documented',
          'Development environment setup',
        ],
        riskFactors: [
          'Stakeholder availability for requirements',
          'Integration access and credentials',
        ],
      },
      {
        name: 'Foundation & Infrastructure',
        description:
          'Core infrastructure, security controls, CI/CD pipeline',
        durationWeeks: foundationWeeks,
        sprints: [] as Array<{
          number: number;
          focus: string;
          deliverables: string[];
        }>,
        milestones: [
          'Infrastructure deployed',
          'Security controls implemented',
          'CI/CD pipeline operational',
        ],
        riskFactors: [
          'Cloud resource provisioning delays',
          'Security review cycles',
        ],
      },
      {
        name: 'Core Development',
        description:
          'Primary feature development, integrations, LLM implementation',
        durationWeeks: coreDevWeeks,
        sprints: [] as Array<{
          number: number;
          focus: string;
          deliverables: string[];
        }>,
        milestones: [
          'Core features functional',
          'LLM integration complete',
          'External integrations working',
        ],
        riskFactors: [
          'LLM performance tuning',
          'Integration API limitations',
        ],
      },
      {
        name: 'Testing & Hardening',
        description:
          'Comprehensive testing, security audit, performance optimization',
        durationWeeks: testingWeeks,
        sprints: [] as Array<{
          number: number;
          focus: string;
          deliverables: string[];
        }>,
        milestones: [
          'UAT complete',
          'Security audit passed',
          'Performance benchmarks met',
        ],
        riskFactors: [
          'Bug remediation cycles',
          'Compliance audit findings',
        ],
      },
    ];

    // Assign sprints to phases
    let sprintNum = 1;
    for (const phase of phases) {
      const phaseSprints = Math.ceil(
        phase.durationWeeks / sprintLengthWeeks
      );
      for (
        let i = 0;
        i < phaseSprints && sprintNum <= totalSprints;
        i++
      ) {
        phase.sprints.push({
          number: sprintNum,
          focus: `${phase.name} - Sprint ${i + 1}`,
          deliverables: [
            `Sprint ${sprintNum} deliverables TBD based on detailed planning`,
          ],
        });
        sprintNum++;
      }
    }

    // Industry-aware skill requirements
    const skillRequirements = knowledgeBase.getIndustrySkillRequirements(projectContext.industry);

    // Generate Jira tickets if requested
    const jiraTickets = includeJiraTickets
      ? [
          {
            type: 'epic' as const,
            summary: 'Infrastructure & Security Foundation',
            description:
              'Set up cloud infrastructure with security controls and compliance requirements',
            labels: [
              'infrastructure',
              'security',
              projectContext.industry,
            ],
            estimateHours: 80,
          },
          {
            type: 'epic' as const,
            summary: 'LLM Integration & Core Features',
            description: `Implement ${pattern?.name || architecturePattern} pattern with Claude API integration`,
            labels: ['development', 'llm', 'core'],
            estimateHours: 160,
          },
          {
            type: 'epic' as const,
            summary: 'Compliance Implementation',
            description:
              'Implement compliance controls and documentation',
            labels: [
              'compliance',
              ...(projectContext.complianceTags || []),
            ],
            estimateHours: 60,
          },
          {
            type: 'story' as const,
            summary: 'Set up development environment',
            description:
              'Configure local development environment with necessary tools and access',
            labels: ['setup', 'sprint-1'],
            estimateHours: 8,
          },
          {
            type: 'story' as const,
            summary: 'Implement audit logging',
            description:
              'Set up comprehensive audit logging for all data access and LLM interactions',
            labels: ['security', 'compliance', 'logging'],
            estimateHours: 16,
          },
          {
            type: 'story' as const,
            summary: 'Configure encryption at rest',
            description:
              'Enable encryption for all data stores per compliance requirements',
            labels: ['security', 'infrastructure'],
            estimateHours: 8,
          },
          {
            type: 'task' as const,
            summary: 'Execute BAA with Anthropic',
            description:
              'Coordinate with legal to execute Business Associate Agreement for Claude API usage',
            labels: ['compliance', 'legal'],
            estimateHours: 4,
          },
        ]
      : undefined;

    const output = {
      summary: {
        totalWeeks,
        totalSprints,
        teamSize,
        phases: phases.length,
      },
      phases,
      skillRequirements,
      jiraTickets,
    };

    return NextResponse.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
