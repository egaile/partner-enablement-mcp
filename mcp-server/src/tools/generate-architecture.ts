import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GenerateArchitectureInputSchema,
  type GenerateArchitectureInput
} from "../schemas/index.js";
import type { KnowledgeBase } from "../services/knowledgeBase.js";

export function registerGenerateArchitecture(
  server: McpServer,
  knowledgeBase: KnowledgeBase
): void {
  server.registerTool(
    "partner_generate_reference_architecture",
    {
      title: "Generate Reference Architecture",
      description: `Generate a compliant reference architecture based on project context.

Analyzes project requirements and recommends appropriate architecture patterns,
cloud services, security considerations, and provides Mermaid diagrams.

Args:
  - projectContext (object): Project context from read_project_context or manual input
  - focusAreas (string[]): Specific areas to emphasize (optional)
  - includeAlternatives (boolean): Include alternative patterns (default: false)
  - includeDiagram (boolean): Include Mermaid diagram (default: true)
  - responseFormat ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Reference architecture including pattern selection, component breakdown,
  cloud service mappings, data flow, and security considerations.`,
      inputSchema: GenerateArchitectureInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: GenerateArchitectureInput) => {
      try {
        const { projectContext } = params;

        // Recommend pattern based on use case
        const recommendedPatternId = knowledgeBase.recommendPattern(
          projectContext.useCaseDescription,
          projectContext.complianceTags || []
        );

        const pattern = knowledgeBase.getArchitecturePattern(recommendedPatternId);
        if (!pattern) {
          throw new Error(`Pattern '${recommendedPatternId}' not found in knowledge base`);
        }

        // Get cloud-specific services
        const cloudProvider = projectContext.cloudProvider || "aws";
        const components = Object.entries(pattern.components).map(([key, comp]) => ({
          name: key,
          description: comp.description,
          services: {
            [cloudProvider]: comp.services[cloudProvider as keyof typeof comp.services] || [],
            anthropic: comp.services.anthropic || []
          },
          considerations: [] as string[]
        }));

        // Add compliance-specific considerations
        const complianceFrameworks = projectContext.complianceTags || [];
        for (const framework of complianceFrameworks) {
          const frameworkData = knowledgeBase.getComplianceFramework(framework);
          if (frameworkData) {
            for (const comp of components) {
              const implications = frameworkData.architectureImplications[comp.name];
              if (implications) {
                comp.considerations.push(...implications.implementation);
              }
            }
          }
        }

        // Sort components to prioritize focusAreas
        const focusAreas = params.focusAreas || [];
        if (focusAreas.length > 0) {
          const focusLower = focusAreas.map(f => f.toLowerCase());
          components.sort((a, b) => {
            const aMatch = focusLower.some(f => a.name.toLowerCase().includes(f) || a.description.toLowerCase().includes(f));
            const bMatch = focusLower.some(f => b.name.toLowerCase().includes(f) || b.description.toLowerCase().includes(f));
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return 0;
          });
        }

        // Only append ellipsis when description exceeds 100 chars
        const desc = projectContext.useCaseDescription;
        const truncatedDesc = desc.length > 100 ? `${desc.substring(0, 100)}...` : desc;
        let rationaleStr = `Based on the use case "${truncatedDesc}", the ${pattern.name} pattern is recommended because it supports ${pattern.useCases[0]?.toLowerCase() || "your requirements"}.`;
        if (focusAreas.length > 0) {
          rationaleStr += ` Focus areas: ${focusAreas.join(", ")}.`;
        }

        const output = {
          pattern: recommendedPatternId,
          patternName: pattern.name,
          rationale: rationaleStr,
          components,
          dataFlow: pattern.dataFlow,
          mermaidDiagram: params.includeDiagram ? pattern.mermaidDiagram : undefined,
          securityConsiderations: [
            ...pattern.securityConsiderations,
            ...(complianceFrameworks.includes("hipaa") ? [
              "BAA required with Claude API provider",
              "PHI must be encrypted at rest and in transit",
              "Comprehensive audit logging required for all PHI access"
            ] : [])
          ],
          scalingConsiderations: pattern.scalingConsiderations || [],
          alternatives: params.includeAlternatives ?
            Object.entries(knowledgeBase.getAllPatterns())
              .filter(([id]) => id !== recommendedPatternId)
              .slice(0, 2)
              .map(([id, p]) => ({
                pattern: id,
                rationale: `Consider if ${p.useCases[0]}`
              })) : undefined
        };

        if (params.responseFormat === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output
          };
        }

        // Markdown format
        let markdown = `# Reference Architecture: ${pattern.name}\n\n`;
        markdown += `## Pattern Selection\n`;
        markdown += `**Recommended Pattern:** ${pattern.name}\n\n`;
        markdown += `**Rationale:** ${output.rationale}\n\n`;

        markdown += `## Architecture Overview\n`;
        markdown += `${pattern.description}\n\n`;

        if (params.includeDiagram && pattern.mermaidDiagram) {
          markdown += `## Architecture Diagram\n`;
          markdown += "```mermaid\n";
          markdown += pattern.mermaidDiagram;
          markdown += "\n```\n\n";
        }

        markdown += `## Components\n\n`;
        for (const comp of components) {
          markdown += `### ${comp.name}\n`;
          markdown += `${comp.description}\n\n`;
          markdown += `**${cloudProvider.toUpperCase()} Services:**\n`;
          for (const service of comp.services[cloudProvider] || []) {
            markdown += `- ${service}\n`;
          }
          if (comp.services.anthropic && comp.services.anthropic.length > 0) {
            markdown += `\n**Anthropic Services:**\n`;
            for (const service of comp.services.anthropic) {
              markdown += `- ${service}\n`;
            }
          }
          if (comp.considerations.length > 0) {
            markdown += `\n**Implementation Considerations:**\n`;
            for (const consideration of comp.considerations) {
              markdown += `- ${consideration}\n`;
            }
          }
          markdown += "\n";
        }

        markdown += `## Data Flow\n`;
        for (const step of pattern.dataFlow) {
          markdown += `${step}\n`;
        }
        markdown += "\n";

        markdown += `## Security Considerations\n`;
        for (const consideration of output.securityConsiderations) {
          markdown += `- ${consideration}\n`;
        }
        markdown += "\n";

        if (output.scalingConsiderations.length > 0) {
          markdown += `## Scaling Considerations\n`;
          for (const consideration of output.scalingConsiderations) {
            markdown += `- ${consideration}\n`;
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
            text: `Error generating architecture: ${errorMessage}`
          }]
        };
      }
    }
  );
}
