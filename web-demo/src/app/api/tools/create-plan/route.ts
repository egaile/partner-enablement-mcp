import { NextResponse } from 'next/server';
import { knowledgeBase } from '../_shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      projectContext,
      architecturePattern,
      teamSize = 5,
      timelineWeeks,
      includeJiraTickets = true,
      sprintLengthWeeks = 2,
    } = body;

    if (!projectContext || !architecturePattern) {
      return NextResponse.json(
        { error: 'projectContext and architecturePattern are required' },
        { status: 400 }
      );
    }

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

    // Define phases
    const phases = [
      {
        name: 'Discovery & Design',
        description:
          'Requirements gathering, architecture design, compliance planning',
        durationWeeks: Math.ceil(totalWeeks * 0.2),
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
        durationWeeks: Math.ceil(totalWeeks * 0.25),
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
        durationWeeks: Math.ceil(totalWeeks * 0.35),
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
        durationWeeks: Math.ceil(totalWeeks * 0.2),
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

    // Define skill requirements
    const skillRequirements = [
      {
        skill: 'Cloud Architecture (AWS/GCP)',
        level: 'required' as const,
        roles: ['Solutions Architect', 'DevOps Engineer'],
      },
      {
        skill: 'LLM/AI Development',
        level: 'required' as const,
        roles: ['AI Engineer', 'Backend Developer'],
      },
      {
        skill: 'Security & Compliance',
        level: 'required' as const,
        roles: ['Security Engineer', 'Compliance Lead'],
      },
      {
        skill: 'Frontend Development',
        level: 'preferred' as const,
        roles: ['Frontend Developer'],
      },
      {
        skill: 'Healthcare Domain Knowledge',
        level: 'preferred' as const,
        roles: ['Business Analyst', 'Product Owner'],
      },
    ];

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
