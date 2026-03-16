import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CreateImplementationPlanInputSchema,
  type CreateImplementationPlanInput
} from "../schemas/index.js";
import type { KnowledgeBase } from "../services/knowledgeBase.js";

export function registerCreateImplementationPlan(
  server: McpServer,
  knowledgeBase: KnowledgeBase
): void {
  server.registerTool(
    "partner_create_implementation_plan",
    {
      title: "Create Implementation Plan",
      description: `Create a phased implementation plan with sprint structure and Jira ticket templates.

Generates a detailed project plan based on architecture pattern and project context,
including phases, sprints, milestones, and optionally Jira ticket templates.

Args:
  - projectContext (object): Project context
  - architecturePattern: Selected pattern ('rag_document_qa', 'conversational_agent', etc.)
  - teamSize (number): Expected team size (default: 5)
  - timelineWeeks (number): Target timeline in weeks (optional - estimates if not provided)
  - includeJiraTickets (boolean): Generate Jira ticket templates (default: true)
  - sprintLengthWeeks (number): Sprint length, 1-4 weeks (default: 2)
  - responseFormat ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Implementation plan with phases, sprints, milestones, skill requirements,
  and Jira ticket templates.`,
      inputSchema: CreateImplementationPlanInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: CreateImplementationPlanInput) => {
      try {
        const {
          projectContext,
          architecturePattern,
          teamSize,
          sprintLengthWeeks
        } = params;

        // Get pattern for timeline estimation
        const pattern = knowledgeBase.getArchitecturePattern(architecturePattern);
        const matchedUseCase = knowledgeBase.matchUseCase(
          projectContext.industry,
          projectContext.useCaseDescription
        );

        // Estimate timeline if not provided
        let totalWeeks = params.timelineWeeks;
        if (!totalWeeks) {
          // Base estimate on complexity
          const complexityWeeks: Record<string, number> = {
            "low": 8,
            "medium": 14,
            "high": 22
          };
          totalWeeks = complexityWeeks[matchedUseCase?.estimatedComplexity || "medium"];
        }

        const totalSprints = Math.ceil(totalWeeks / sprintLengthWeeks);

        // Define phases — assign last phase as remainder to avoid ceiling overshoot
        const discoveryWeeks = Math.ceil(totalWeeks * 0.2);
        const foundationWeeks = Math.ceil(totalWeeks * 0.25);
        const coreDevWeeks = Math.ceil(totalWeeks * 0.35);
        const testingWeeks = Math.max(1, totalWeeks - discoveryWeeks - foundationWeeks - coreDevWeeks);

        const phases = [
          {
            name: "Discovery & Design",
            description: "Requirements gathering, architecture design, compliance planning",
            durationWeeks: discoveryWeeks,
            sprints: [] as Array<{ number: number; focus: string; deliverables: string[] }>,
            milestones: [
              "Architecture design approved",
              "Compliance requirements documented",
              "Development environment setup"
            ],
            riskFactors: [
              "Stakeholder availability for requirements",
              "Integration access and credentials"
            ]
          },
          {
            name: "Foundation & Infrastructure",
            description: "Core infrastructure, security controls, CI/CD pipeline",
            durationWeeks: foundationWeeks,
            sprints: [] as Array<{ number: number; focus: string; deliverables: string[] }>,
            milestones: [
              "Infrastructure deployed",
              "Security controls implemented",
              "CI/CD pipeline operational"
            ],
            riskFactors: [
              "Cloud resource provisioning delays",
              "Security review cycles"
            ]
          },
          {
            name: "Core Development",
            description: "Primary feature development, integrations, LLM implementation",
            durationWeeks: coreDevWeeks,
            sprints: [] as Array<{ number: number; focus: string; deliverables: string[] }>,
            milestones: [
              "Core features functional",
              "LLM integration complete",
              "External integrations working"
            ],
            riskFactors: [
              "LLM performance tuning",
              "Integration API limitations"
            ]
          },
          {
            name: "Testing & Hardening",
            description: "Comprehensive testing, security audit, performance optimization",
            durationWeeks: testingWeeks,
            sprints: [] as Array<{ number: number; focus: string; deliverables: string[] }>,
            milestones: [
              "UAT complete",
              "Security audit passed",
              "Performance benchmarks met"
            ],
            riskFactors: [
              "Bug remediation cycles",
              "Compliance audit findings"
            ]
          }
        ];

        // Assign sprints to phases
        let sprintNum = 1;
        for (const phase of phases) {
          const phaseSprints = Math.ceil(phase.durationWeeks / sprintLengthWeeks);
          for (let i = 0; i < phaseSprints && sprintNum <= totalSprints; i++) {
            phase.sprints.push({
              number: sprintNum,
              focus: `${phase.name} - Sprint ${i + 1}`,
              deliverables: [`Sprint ${sprintNum} deliverables TBD based on detailed planning`]
            });
            sprintNum++;
          }
        }

        // Define skill requirements based on industry
        const skillRequirements = knowledgeBase.getIndustrySkillRequirements(projectContext.industry);

        // Generate Jira tickets if requested
        const jiraTickets = params.includeJiraTickets ? [
          {
            type: "epic" as const,
            summary: "Infrastructure & Security Foundation",
            description: "Set up cloud infrastructure with security controls and compliance requirements",
            labels: ["infrastructure", "security", projectContext.industry],
            estimateHours: 80
          },
          {
            type: "epic" as const,
            summary: "LLM Integration & Core Features",
            description: `Implement ${pattern?.name || architecturePattern} pattern with Claude API integration`,
            labels: ["development", "llm", "core"],
            estimateHours: 160
          },
          {
            type: "epic" as const,
            summary: "Compliance Implementation",
            description: "Implement compliance controls and documentation",
            labels: ["compliance", ...(projectContext.complianceTags || [])],
            estimateHours: 60
          },
          {
            type: "story" as const,
            summary: "Set up development environment",
            description: "Configure local development environment with necessary tools and access",
            labels: ["setup", "sprint-1"],
            estimateHours: 8
          },
          {
            type: "story" as const,
            summary: "Implement audit logging",
            description: "Set up comprehensive audit logging for all data access and LLM interactions",
            labels: ["security", "compliance", "logging"],
            estimateHours: 16
          },
          {
            type: "story" as const,
            summary: "Configure encryption at rest",
            description: "Enable encryption for all data stores per compliance requirements",
            labels: ["security", "infrastructure"],
            estimateHours: 8
          },
          {
            type: "task" as const,
            summary: "Execute BAA with Anthropic",
            description: "Coordinate with legal to execute Business Associate Agreement for Claude API usage",
            labels: ["compliance", "legal"],
            estimateHours: 4
          }
        ] : undefined;

        const output = {
          summary: {
            totalWeeks,
            totalSprints,
            teamSize,
            phases: phases.length
          },
          phases,
          skillRequirements,
          jiraTickets
        };

        if (params.responseFormat === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output
          };
        }

        // Markdown format
        let markdown = `# Implementation Plan\n\n`;
        markdown += `## Summary\n`;
        markdown += `- **Total Duration:** ${totalWeeks} weeks (${totalSprints} sprints)\n`;
        markdown += `- **Team Size:** ${teamSize}\n`;
        markdown += `- **Sprint Length:** ${sprintLengthWeeks} weeks\n`;
        markdown += `- **Architecture Pattern:** ${pattern?.name || architecturePattern}\n\n`;

        markdown += `## Phases\n\n`;
        for (const phase of phases) {
          markdown += `### ${phase.name}\n`;
          markdown += `${phase.description}\n\n`;
          markdown += `**Duration:** ${phase.durationWeeks} weeks | **Sprints:** ${phase.sprints.length}\n\n`;

          markdown += `**Milestones:**\n`;
          for (const milestone of phase.milestones) {
            markdown += `- ✓ ${milestone}\n`;
          }
          markdown += "\n";

          markdown += `**Risk Factors:**\n`;
          for (const risk of phase.riskFactors) {
            markdown += `- ⚠️ ${risk}\n`;
          }
          markdown += "\n";
        }

        markdown += `## Skill Requirements\n\n`;
        for (const skill of skillRequirements) {
          const icon = skill.level === "required" ? "🔴" : "🟡";
          markdown += `- ${icon} **${skill.skill}** (${skill.level})\n`;
          markdown += `  - Roles: ${skill.roles.join(", ")}\n`;
        }
        markdown += "\n";

        if (jiraTickets) {
          markdown += `## Jira Ticket Templates\n\n`;
          for (const ticket of jiraTickets) {
            markdown += `### [${ticket.type.toUpperCase()}] ${ticket.summary}\n`;
            markdown += `${ticket.description}\n`;
            markdown += `- **Labels:** ${ticket.labels.join(", ")}\n`;
            if (ticket.estimateHours) {
              markdown += `- **Estimate:** ${ticket.estimateHours} hours\n`;
            }
            markdown += "\n";
          }
        }

        return {
          content: [{ type: "text", text: markdown }],
          structuredContent: output
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error creating implementation plan: ${errorMessage}`
          }]
        };
      }
    }
  );
}
