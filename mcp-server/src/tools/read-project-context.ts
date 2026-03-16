import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ReadProjectContextInputSchema,
  type ReadProjectContextInput
} from "../schemas/index.js";
import type { JiraClient, MockJiraClient } from "../services/jiraClient.js";

export function registerReadProjectContext(
  server: McpServer,
  jiraClient: JiraClient | MockJiraClient
): void {
  server.registerTool(
    "partner_read_project_context",
    {
      title: "Read Project Context from Jira",
      description: `Read project requirements and context from a Jira project to inform architecture and compliance recommendations.

This tool connects to Jira Cloud to extract:
- Project metadata (name, description, lead)
- Recent issues with requirements and specifications
- Labels indicating compliance needs (hipaa, phi, etc.)
- Integration targets and technical requirements

Args:
  - projectKey (string): Jira project key (e.g., 'HEALTH', 'CLAIMS')
  - includeIssues (boolean): Whether to include recent issues (default: true)
  - issueLimit (number): Max issues to retrieve, 1-50 (default: 10)
  - responseFormat ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Project context including metadata, requirements extracted from issues,
  detected compliance needs, and integration targets.

Examples:
  - "Get context from HEALTH project" → projectKey="HEALTH"
  - "Read CLAIMS project with all recent issues" → projectKey="CLAIMS", issueLimit=50`,
      inputSchema: ReadProjectContextInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: ReadProjectContextInput) => {
      try {
        // Get project details
        const project = await jiraClient.getProject(params.projectKey);

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

        if (params.includeIssues) {
          const searchResult = await jiraClient.searchIssues(params.projectKey, {
            maxResults: params.issueLimit
          });
          issues = searchResult.issues.map(issue => ({
            key: issue.key,
            summary: issue.fields.summary,
            description: issue.fields.description || undefined,
            type: issue.fields.issuetype.name,
            status: issue.fields.status.name,
            labels: issue.fields.labels,
            priority: issue.fields.priority?.name
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
        if (allLabels.has("hipaa") || allLabels.has("phi")) {
          complianceIndicators.push("HIPAA compliance required");
        }
        if (allLabels.has("pci") || allLabels.has("pci_dss") || allLabels.has("payment")) {
          complianceIndicators.push("PCI-DSS compliance may be required");
        }
        if (allLabels.has("soc2")) {
          complianceIndicators.push("SOC2 compliance required");
        }

        // Detect integration targets
        const integrationTargets: string[] = [];
        const descriptionText = issues
          .map(i => `${i.summary} ${i.description || ""}`)
          .join(" ")
          .toLowerCase();

        if (descriptionText.includes("epic") || descriptionText.includes("ehr")) {
          integrationTargets.push("Epic EHR");
        }
        if (descriptionText.includes("cerner")) {
          integrationTargets.push("Cerner EHR");
        }
        if (descriptionText.includes("fhir")) {
          integrationTargets.push("FHIR APIs");
        }
        if (descriptionText.includes("salesforce")) {
          integrationTargets.push("Salesforce");
        }

        // Build output
        const output = {
          project: {
            key: project.key,
            name: project.name,
            description: project.description,
            lead: project.lead?.displayName
          },
          issues: issues,
          detectedCompliance: complianceIndicators,
          detectedIntegrations: integrationTargets,
          allLabels: Array.from(allLabels).sort(),
          summary: {
            totalIssues: issues.length,
            byType: issues.reduce((acc, i) => {
              acc[i.type] = (acc[i.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            byStatus: issues.reduce((acc, i) => {
              acc[i.status] = (acc[i.status] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          }
        };

        if (params.responseFormat === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output
          };
        }

        // Markdown format
        let markdown = `# Project Context: ${project.name}\n\n`;
        markdown += `**Key:** ${project.key}\n`;
        markdown += `**Lead:** ${project.lead?.displayName || "Not assigned"}\n\n`;

        if (project.description) {
          markdown += `## Description\n${project.description}\n\n`;
        }

        if (complianceIndicators.length > 0) {
          markdown += `## Compliance Indicators\n`;
          for (const indicator of complianceIndicators) {
            markdown += `- ⚠️ ${indicator}\n`;
          }
          markdown += "\n";
        }

        if (integrationTargets.length > 0) {
          markdown += `## Detected Integration Targets\n`;
          for (const target of integrationTargets) {
            markdown += `- ${target}\n`;
          }
          markdown += "\n";
        }

        if (issues.length > 0) {
          markdown += `## Recent Issues (${issues.length})\n\n`;
          for (const issue of issues) {
            markdown += `### ${issue.key}: ${issue.summary}\n`;
            markdown += `**Type:** ${issue.type} | **Status:** ${issue.status}`;
            if (issue.priority) {
              markdown += ` | **Priority:** ${issue.priority}`;
            }
            markdown += "\n";
            if (issue.labels.length > 0) {
              markdown += `**Labels:** ${issue.labels.join(", ")}\n`;
            }
            if (issue.description) {
              markdown += `\n${issue.description.substring(0, 500)}${issue.description.length > 500 ? "..." : ""}\n`;
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
            text: `Error reading project context: ${errorMessage}`
          }]
        };
      }
    }
  );
}
