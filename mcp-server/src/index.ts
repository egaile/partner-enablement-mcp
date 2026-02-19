import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import {
  ReadProjectContextInputSchema,
  GenerateArchitectureInputSchema,
  AssessComplianceInputSchema,
  CreateImplementationPlanInputSchema,
  type ReadProjectContextInput,
  type GenerateArchitectureInput,
  type AssessComplianceInput,
  type CreateImplementationPlanInput
} from "./schemas/index.js";

import { createJiraClient } from "./services/jiraClient.js";
import { knowledgeBase } from "./services/knowledgeBase.js";

// Initialize MCP Server
const server = new McpServer({
  name: "partner-enablement-mcp-server",
  version: "1.0.0"
});

// Initialize Jira client (uses mock if not configured)
const jiraClient = createJiraClient();

// =============================================================================
// Tool: partner_read_project_context
// =============================================================================
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

// =============================================================================
// Tool: partner_generate_reference_architecture
// =============================================================================
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

      // Build output
      // Phase 6.5: Sort components to prioritize focusAreas
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

      // Phase 6.4: Only append ellipsis when description exceeds 100 chars
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

// =============================================================================
// Tool: partner_assess_compliance
// =============================================================================
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

// =============================================================================
// Tool: partner_create_implementation_plan
// =============================================================================
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

// =============================================================================
// Server Transport Setup
// =============================================================================
async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Partner Enablement MCP Server running on stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", server: "partner-enablement-mcp-server" });
  });

  // Create a single transport and connect once — reuse across requests
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  await server.connect(transport);

  app.post("/mcp", async (req, res) => {
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => {
    console.error(`Partner Enablement MCP Server running on http://localhost:${port}/mcp`);
  });
}

// Choose transport based on environment
const transport = process.env.TRANSPORT || "stdio";
if (transport === "http") {
  runHTTP().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
