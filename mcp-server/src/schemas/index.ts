import { z } from "zod";

// Enums
export const IndustryVertical = z.enum([
  "healthcare",
  "financial_services",
  "education",
  "public_sector"
]);

export const CloudProvider = z.enum(["aws", "gcp", "azure", "multi_cloud"]);

export const ComplianceFramework = z.enum([
  "hipaa",
  "soc2",
  "fedramp",
  "pci_dss",
  "gdpr",
  "ccpa"
]);

export const ArchitecturePattern = z.enum([
  "rag_document_qa",
  "conversational_agent",
  "batch_processing",
  "human_in_the_loop"
]);

export const ResponseFormat = z.enum(["json", "markdown"]);

// Project Context Schema - input from Jira
export const ProjectContextSchema = z.object({
  projectKey: z.string()
    .min(1)
    .max(20)
    .describe("Jira project key (e.g., 'HEALTH', 'CLAIMS')"),
  industry: IndustryVertical
    .describe("Industry vertical for compliance and pattern selection"),
  complianceTags: z.array(ComplianceFramework)
    .optional()
    .describe("Compliance frameworks that apply to this project"),
  cloudProvider: CloudProvider
    .default("aws")
    .describe("Target cloud platform"),
  useCaseDescription: z.string()
    .min(10)
    .max(2000)
    .describe("Description of the intended use case"),
  dataTypes: z.array(z.string())
    .optional()
    .describe("Types of data being processed (e.g., 'PHI', 'PII', 'financial')"),
  integrationTargets: z.array(z.string())
    .optional()
    .describe("Systems to integrate with (e.g., 'Epic EHR', 'Salesforce')"),
  scaleIndicators: z.object({
    expectedUsers: z.number().optional(),
    expectedDocuments: z.number().optional(),
    expectedTransactionsPerDay: z.number().optional()
  }).optional()
    .describe("Scale indicators for architecture sizing"),
  responseFormat: ResponseFormat
    .default("markdown")
    .describe("Output format preference")
}).strict();

export type ProjectContext = z.infer<typeof ProjectContextSchema>;

// Read Project Context Tool Schema
export const ReadProjectContextInputSchema = z.object({
  projectKey: z.string()
    .min(1)
    .max(20)
    .describe("Jira project key to read context from"),
  includeIssues: z.boolean()
    .default(true)
    .describe("Whether to include recent issues for context"),
  issueLimit: z.number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of issues to retrieve"),
  responseFormat: ResponseFormat
    .default("markdown")
    .describe("Output format: 'markdown' for human-readable or 'json' for structured")
}).strict();

export type ReadProjectContextInput = z.infer<typeof ReadProjectContextInputSchema>;

// Generate Architecture Tool Schema
export const GenerateArchitectureInputSchema = z.object({
  projectContext: ProjectContextSchema
    .describe("Project context from read_project_context or manual input"),
  focusAreas: z.array(z.string())
    .optional()
    .describe("Specific areas to emphasize in the architecture"),
  includeAlternatives: z.boolean()
    .default(false)
    .describe("Whether to include alternative pattern recommendations"),
  includeDiagram: z.boolean()
    .default(true)
    .describe("Whether to include Mermaid diagram code"),
  responseFormat: ResponseFormat
    .default("markdown")
    .describe("Output format preference")
}).strict();

export type GenerateArchitectureInput = z.infer<typeof GenerateArchitectureInputSchema>;

// Assess Compliance Tool Schema
export const AssessComplianceInputSchema = z.object({
  projectContext: ProjectContextSchema
    .describe("Project context to assess"),
  detailLevel: z.enum(["summary", "detailed", "comprehensive"])
    .default("detailed")
    .describe("Level of detail in compliance assessment"),
  includeChecklist: z.boolean()
    .default(true)
    .describe("Whether to include implementation checklist"),
  responseFormat: ResponseFormat
    .default("markdown")
    .describe("Output format preference")
}).strict();

export type AssessComplianceInput = z.infer<typeof AssessComplianceInputSchema>;

// Create Implementation Plan Tool Schema
export const CreateImplementationPlanInputSchema = z.object({
  projectContext: ProjectContextSchema
    .describe("Project context for implementation planning"),
  architecturePattern: ArchitecturePattern
    .describe("Selected architecture pattern"),
  teamSize: z.number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .describe("Expected team size"),
  timelineWeeks: z.number()
    .int()
    .min(4)
    .max(52)
    .optional()
    .describe("Target timeline in weeks (optional - will estimate if not provided)"),
  includeJiraTickets: z.boolean()
    .default(true)
    .describe("Whether to generate Jira ticket templates"),
  sprintLengthWeeks: z.number()
    .int()
    .min(1)
    .max(4)
    .default(2)
    .describe("Sprint length in weeks"),
  responseFormat: ResponseFormat
    .default("markdown")
    .describe("Output format preference")
}).strict();

export type CreateImplementationPlanInput = z.infer<typeof CreateImplementationPlanInputSchema>;

// Output Schemas
export const ArchitectureOutputSchema = z.object({
  pattern: ArchitecturePattern,
  patternName: z.string(),
  rationale: z.string(),
  components: z.array(z.object({
    name: z.string(),
    description: z.string(),
    services: z.record(z.array(z.string())),
    considerations: z.array(z.string())
  })),
  dataFlow: z.array(z.string()),
  mermaidDiagram: z.string().optional(),
  securityConsiderations: z.array(z.string()),
  scalingConsiderations: z.array(z.string()),
  alternatives: z.array(z.object({
    pattern: ArchitecturePattern,
    rationale: z.string()
  })).optional()
});

export type ArchitectureOutput = z.infer<typeof ArchitectureOutputSchema>;

export const ComplianceAssessmentSchema = z.object({
  applicableFrameworks: z.array(z.object({
    framework: ComplianceFramework,
    name: z.string(),
    applicabilityReason: z.string(),
    priority: z.enum(["required", "recommended", "optional"])
  })),
  keyRequirements: z.array(z.object({
    category: z.string(),
    requirement: z.string(),
    implementation: z.string(),
    priority: z.enum(["critical", "high", "medium", "low"])
  })),
  riskAreas: z.array(z.object({
    area: z.string(),
    risk: z.string(),
    mitigation: z.string()
  })),
  checklist: z.array(z.object({
    item: z.string(),
    category: z.string(),
    completed: z.boolean()
  })).optional()
});

export type ComplianceAssessment = z.infer<typeof ComplianceAssessmentSchema>;

export const ImplementationPlanSchema = z.object({
  summary: z.object({
    totalWeeks: z.number(),
    totalSprints: z.number(),
    teamSize: z.number(),
    phases: z.number()
  }),
  phases: z.array(z.object({
    name: z.string(),
    description: z.string(),
    durationWeeks: z.number(),
    sprints: z.array(z.object({
      number: z.number(),
      focus: z.string(),
      deliverables: z.array(z.string())
    })),
    milestones: z.array(z.string()),
    riskFactors: z.array(z.string())
  })),
  skillRequirements: z.array(z.object({
    skill: z.string(),
    level: z.enum(["required", "preferred"]),
    roles: z.array(z.string())
  })),
  jiraTickets: z.array(z.object({
    type: z.enum(["epic", "story", "task"]),
    summary: z.string(),
    description: z.string(),
    labels: z.array(z.string()),
    estimateHours: z.number().optional()
  })).optional()
});

export type ImplementationPlan = z.infer<typeof ImplementationPlanSchema>;
