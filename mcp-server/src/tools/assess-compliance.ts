import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  AssessComplianceInputSchema,
  type AssessComplianceInput
} from "../schemas/index.js";
import type { KnowledgeBase } from "../services/knowledgeBase.js";

export function registerAssessCompliance(
  server: McpServer,
  knowledgeBase: KnowledgeBase
): void {
  server.registerTool(
    "partner_assess_compliance",
    {
      title: "Assess Compliance Requirements",
      description: `Assess compliance requirements for a project and generate implementation guidance.

Analyzes project context to identify applicable regulatory frameworks and
provides specific implementation requirements and checklists.

Args:
  - projectContext (object): Project context to assess
  - detailLevel ('summary' | 'detailed' | 'comprehensive'): Detail level (default: 'detailed')
  - includeChecklist (boolean): Include implementation checklist (default: true)
  - responseFormat ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Compliance assessment including applicable frameworks, key requirements,
  risk areas, and implementation checklist.`,
      inputSchema: AssessComplianceInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: AssessComplianceInput) => {
      try {
        const { projectContext, detailLevel } = params;

        // Determine applicable frameworks
        const applicableFrameworks = knowledgeBase.getApplicableFrameworks(
          projectContext.industry,
          projectContext.dataTypes || []
        );

        // Get framework details
        const frameworkDetails = applicableFrameworks.map(fwId => {
          const fw = knowledgeBase.getComplianceFramework(fwId);
          return {
            framework: fwId,
            name: fw?.name || fwId.toUpperCase(),
            applicabilityReason: fw?.applicableWhen?.[0] || "Based on project industry",
            priority: projectContext.complianceTags?.includes(fwId as "hipaa" | "soc2" | "fedramp" | "pci_dss" | "gdpr" | "ccpa")
              ? "required" as const
              : "recommended" as const
          };
        });

        // Get detailed requirements
        const requirements = knowledgeBase.getComplianceRequirements(applicableFrameworks);

        // Identify risk areas
        const riskAreas: Array<{ area: string; risk: string; mitigation: string }> = [];

        if (applicableFrameworks.includes("hipaa")) {
          riskAreas.push({
            area: "PHI in LLM Prompts",
            risk: "Protected Health Information may be included in prompts sent to Claude API",
            mitigation: "Ensure BAA is in place with Anthropic; implement PHI detection and masking where appropriate"
          });
          riskAreas.push({
            area: "Conversation Logging",
            risk: "Chat logs containing PHI require same protections as other PHI",
            mitigation: "Encrypt conversation storage; implement access controls; define retention policies"
          });
        }

        if (projectContext.integrationTargets?.some(t =>
          t.toLowerCase().includes("ehr") || t.toLowerCase().includes("epic")
        )) {
          riskAreas.push({
            area: "EHR Integration",
            risk: "Integration with EHR systems expands attack surface and compliance scope",
            mitigation: "Follow vendor security guidelines; implement API access controls; audit all data access"
          });
        }

        // Build checklist
        const checklist = params.includeChecklist ? [
          { item: "BAA executed with LLM provider", category: "Legal", completed: false },
          { item: "Data encryption at rest configured", category: "Technical", completed: false },
          { item: "Data encryption in transit (TLS 1.2+)", category: "Technical", completed: false },
          { item: "Audit logging implemented", category: "Technical", completed: false },
          { item: "Access controls and RBAC configured", category: "Technical", completed: false },
          { item: "Security risk assessment completed", category: "Administrative", completed: false },
          { item: "Incident response plan documented", category: "Administrative", completed: false },
          { item: "Staff training completed", category: "Administrative", completed: false },
          { item: "Data retention policy defined", category: "Administrative", completed: false },
          { item: "Penetration testing scheduled", category: "Technical", completed: false }
        ] : undefined;

        const output = {
          applicableFrameworks: frameworkDetails,
          keyRequirements: detailLevel !== "summary" ? requirements.map(r => ({
            ...r,
            priority: r.priority as "critical" | "high" | "medium" | "low"
          })) : [],
          riskAreas,
          checklist
        };

        if (params.responseFormat === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output
          };
        }

        // Markdown format
        let markdown = `# Compliance Assessment\n\n`;
        markdown += `**Industry:** ${projectContext.industry}\n`;
        markdown += `**Data Types:** ${projectContext.dataTypes?.join(", ") || "Not specified"}\n\n`;

        markdown += `## Applicable Frameworks\n\n`;
        for (const fw of frameworkDetails) {
          const icon = fw.priority === "required" ? "🔴" : "🟡";
          markdown += `### ${icon} ${fw.name}\n`;
          markdown += `**Priority:** ${fw.priority}\n`;
          markdown += `**Reason:** ${fw.applicabilityReason}\n\n`;
        }

        if (detailLevel !== "summary") {
          markdown += `## Key Requirements\n\n`;
          for (const req of requirements) {
            markdown += `### ${req.category}\n`;
            markdown += `**Requirement:** ${req.requirement}\n`;
            markdown += `**Implementation:** ${req.implementation}\n`;
            markdown += `**Priority:** ${req.priority}\n\n`;
          }
        }

        markdown += `## Risk Areas\n\n`;
        for (const risk of riskAreas) {
          markdown += `### ⚠️ ${risk.area}\n`;
          markdown += `**Risk:** ${risk.risk}\n`;
          markdown += `**Mitigation:** ${risk.mitigation}\n\n`;
        }

        if (checklist) {
          markdown += `## Implementation Checklist\n\n`;
          for (const item of checklist) {
            markdown += `- [ ] **${item.category}:** ${item.item}\n`;
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
            text: `Error assessing compliance: ${errorMessage}`
          }]
        };
      }
    }
  );
}
