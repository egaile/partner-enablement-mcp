# PRD 01: MCP Server Specifications

## Document Info
- **Component**: partner-enablement-mcp-server
- **Type**: Model Context Protocol Server
- **Language**: TypeScript
- **Status**: In Development

---

## Overview

The MCP server is the core technical component of this project. It implements four tools that enable Claude to assist with GSI partner enablement workflows.

---

## Architecture

```
mcp-server/
├── src/
│   ├── index.ts                 # Server entry point, tool registration
│   ├── schemas/
│   │   └── index.ts             # Zod schemas for all inputs/outputs
│   ├── services/
│   │   ├── jiraClient.ts        # Jira API client + mock
│   │   └── knowledgeBase.ts     # Knowledge layer access
│   └── knowledge/
│       ├── architectures.json   # Architecture patterns
│       ├── compliance.json      # Compliance frameworks
│       └── industries.json      # Industry templates
├── dist/                        # Compiled JavaScript
├── package.json
└── tsconfig.json
```

---

## Tool Specifications

### Tool 1: partner_read_project_context

#### Purpose
Extract project requirements and context from a Jira project to inform architecture and compliance recommendations.

#### Input Schema

```typescript
{
  projectKey: string;          // Required. Jira project key (e.g., "HEALTH")
  includeIssues: boolean;      // Default: true. Whether to fetch recent issues
  issueLimit: number;          // Default: 10. Max 50. Number of issues to retrieve
  responseFormat: "json" | "markdown";  // Default: "markdown"
}
```

#### Output Structure

```typescript
{
  project: {
    key: string;
    name: string;
    description: string;
    lead: string;
  };
  issues: Array<{
    key: string;
    summary: string;
    description: string;
    type: string;
    status: string;
    labels: string[];
    priority: string;
  }>;
  detectedCompliance: string[];      // e.g., ["HIPAA compliance required"]
  detectedIntegrations: string[];    // e.g., ["Epic EHR", "FHIR APIs"]
  allLabels: string[];
  summary: {
    totalIssues: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
}
```

#### Behavior
1. Call Jira API to get project metadata
2. Search for recent issues in the project
3. Analyze labels for compliance indicators (hipaa, phi, soc2, etc.)
4. Scan descriptions for integration targets (Epic, Cerner, FHIR, etc.)
5. Return structured context

#### Error Handling
- Project not found: Return helpful error with suggestion to check key
- Authentication failed: Return error indicating credential issue
- Jira not configured: Automatically use mock data

---

### Tool 2: partner_generate_reference_architecture

#### Purpose
Generate a compliant reference architecture based on project context, including component breakdown, cloud service mappings, and diagrams.

#### Input Schema

```typescript
{
  projectContext: {
    projectKey: string;
    industry: "healthcare" | "financial_services" | "education" | "public_sector";
    complianceTags: Array<"hipaa" | "soc2" | "fedramp" | "pci_dss" | "gdpr" | "ccpa">;
    cloudProvider: "aws" | "gcp" | "azure" | "multi_cloud";  // Default: "aws"
    useCaseDescription: string;    // 10-2000 chars
    dataTypes: string[];           // e.g., ["PHI", "PII"]
    integrationTargets: string[];  // e.g., ["Epic EHR", "Salesforce"]
    scaleIndicators: {
      expectedUsers: number;
      expectedDocuments: number;
      expectedTransactionsPerDay: number;
    };
  };
  focusAreas: string[];            // Optional areas to emphasize
  includeAlternatives: boolean;    // Default: false
  includeDiagram: boolean;         // Default: true
  responseFormat: "json" | "markdown";
}
```

#### Output Structure

```typescript
{
  pattern: string;                 // e.g., "conversational_agent"
  patternName: string;             // e.g., "Conversational Agent with Tool Use"
  rationale: string;               // Why this pattern was selected
  components: Array<{
    name: string;
    description: string;
    services: {
      aws: string[];
      gcp: string[];
      anthropic: string[];
    };
    considerations: string[];
  }>;
  dataFlow: string[];              // Numbered steps
  mermaidDiagram: string;          // Mermaid diagram code
  securityConsiderations: string[];
  scalingConsiderations: string[];
  alternatives: Array<{            // If includeAlternatives=true
    pattern: string;
    rationale: string;
  }>;
}
```

#### Pattern Selection Logic

```
IF useCaseDescription contains ["clinical", "decision", "approval", "oversight"]
   OR complianceTags requires human review
THEN recommend "human_in_the_loop"

ELSE IF useCaseDescription contains ["batch", "processing", "high volume", "async"]
THEN recommend "batch_processing"

ELSE IF useCaseDescription contains ["document", "search", "qa", "knowledge base"]
   OR requirements include ["citation", "reference"]
THEN recommend "rag_document_qa"

ELSE recommend "conversational_agent"
```

#### Compliance Integration
When HIPAA is in complianceTags, automatically add:
- BAA requirement with Claude API provider
- PHI encryption requirements
- Audit logging requirements
- LLM-specific considerations

---

### Tool 3: partner_assess_compliance

#### Purpose
Analyze project context to identify applicable regulatory frameworks and provide specific implementation requirements.

#### Input Schema

```typescript
{
  projectContext: ProjectContext;  // Same as Tool 2
  detailLevel: "summary" | "detailed" | "comprehensive";  // Default: "detailed"
  includeChecklist: boolean;       // Default: true
  responseFormat: "json" | "markdown";
}
```

#### Output Structure

```typescript
{
  applicableFrameworks: Array<{
    framework: string;             // e.g., "hipaa"
    name: string;                  // e.g., "HIPAA"
    applicabilityReason: string;
    priority: "required" | "recommended" | "optional";
  }>;
  keyRequirements: Array<{
    framework: string;
    category: string;              // e.g., "dataAtRest", "auditLogging"
    requirement: string;
    implementation: string;
    priority: "critical" | "high" | "medium" | "low";
  }>;
  riskAreas: Array<{
    area: string;                  // e.g., "PHI in LLM Prompts"
    risk: string;
    mitigation: string;
  }>;
  checklist: Array<{              // If includeChecklist=true
    item: string;
    category: string;             // "Legal", "Technical", "Administrative"
    completed: boolean;           // Always false initially
  }>;
}
```

#### Framework Detection Logic

```
IF industry = "healthcare" OR dataTypes contains "PHI"
THEN add HIPAA as required

IF dataTypes contains "PII" OR "financial"
THEN add SOC2 as recommended

IF dataTypes contains "payment"
THEN add PCI-DSS as required

IF integrationTargets contains federal systems
THEN add FedRAMP as required
```

---

### Tool 4: partner_create_implementation_plan

#### Purpose
Generate a phased implementation plan with sprint structure, milestones, and Jira ticket templates.

#### Input Schema

```typescript
{
  projectContext: ProjectContext;
  architecturePattern: "rag_document_qa" | "conversational_agent" | "batch_processing" | "human_in_the_loop";
  teamSize: number;                // Default: 5. Range: 1-50
  timelineWeeks: number;           // Optional. Estimated if not provided
  includeJiraTickets: boolean;     // Default: true
  sprintLengthWeeks: number;       // Default: 2. Range: 1-4
  responseFormat: "json" | "markdown";
}
```

#### Output Structure

```typescript
{
  summary: {
    totalWeeks: number;
    totalSprints: number;
    teamSize: number;
    phases: number;
  };
  phases: Array<{
    name: string;                  // e.g., "Discovery & Design"
    description: string;
    durationWeeks: number;
    sprints: Array<{
      number: number;
      focus: string;
      deliverables: string[];
    }>;
    milestones: string[];
    riskFactors: string[];
  }>;
  skillRequirements: Array<{
    skill: string;
    level: "required" | "preferred";
    roles: string[];
  }>;
  jiraTickets: Array<{            // If includeJiraTickets=true
    type: "epic" | "story" | "task";
    summary: string;
    description: string;
    labels: string[];
    estimateHours: number;
  }>;
}
```

#### Phase Structure (Default)

| Phase | Allocation | Focus |
|-------|------------|-------|
| Discovery & Design | 20% | Requirements, architecture, compliance planning |
| Foundation & Infrastructure | 25% | Cloud setup, security controls, CI/CD |
| Core Development | 35% | Features, integrations, LLM implementation |
| Testing & Hardening | 20% | UAT, security audit, performance |

#### Timeline Estimation

```
IF matchedUseCase.complexity = "low" THEN baseWeeks = 8
ELSE IF matchedUseCase.complexity = "medium" THEN baseWeeks = 14
ELSE IF matchedUseCase.complexity = "high" THEN baseWeeks = 22

totalWeeks = userProvided OR baseWeeks
```

---

## Services

### JiraClient

#### Configuration

```typescript
interface JiraClientConfig {
  host: string;      // e.g., "your-domain.atlassian.net"
  email: string;     // Jira account email
  apiToken: string;  // Jira API token
}
```

#### Methods

```typescript
class JiraClient {
  // Check if credentials are configured
  isConfigured(): boolean;
  
  // Get project metadata
  getProject(projectKey: string): Promise<JiraProject>;
  
  // Search issues with JQL
  searchIssues(projectKey: string, options: SearchOptions): Promise<JiraSearchResult>;
  
  // Get single issue
  getIssue(issueKey: string): Promise<JiraIssue>;
  
  // Get unique labels from project
  getProjectLabels(projectKey: string): Promise<string[]>;
}
```

#### Mock Fallback
When Jira is not configured, automatically use MockJiraClient with realistic demo data:
- HEALTH project: Healthcare AI Assistant
- CLAIMS project: Claims Processing Automation

### KnowledgeBase

#### Methods

```typescript
class KnowledgeBase {
  // Compliance
  getComplianceFramework(frameworkId: string): ComplianceFrameworkData;
  getApplicableFrameworks(industry: string, dataTypes: string[]): string[];
  getComplianceRequirements(frameworks: string[]): Requirement[];
  
  // Architecture
  getArchitecturePattern(patternId: string): ArchitecturePatternData;
  getAllPatterns(): Record<string, ArchitecturePatternData>;
  recommendPattern(useCase: string, requirements: string[]): string;
  
  // Industry
  getIndustry(industryId: string): IndustryData;
  getIndustryUseCases(industryId: string): IndustryUseCaseData[];
  matchUseCase(industryId: string, description: string): IndustryUseCaseData;
}
```

---

## Transport Configuration

### stdio (Default)

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

Use for:
- Claude Desktop integration
- Local development
- MCP Inspector testing

### HTTP

```typescript
const app = express();
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  // ... handle request
});
```

Use for:
- Remote access
- Multi-client scenarios
- Web service deployment

---

## Error Handling

### Error Response Format

```typescript
{
  isError: true,
  content: [{
    type: "text",
    text: "Error: [Specific error message]. [Suggestion for resolution]."
  }]
}
```

### Common Errors

| Error | Message | Resolution |
|-------|---------|------------|
| Project not found | "Project 'XXX' not found" | Check project key exists |
| Auth failed | "Jira authentication failed - check credentials" | Verify JIRA_* env vars |
| Invalid input | Zod validation error message | Fix input per schema |
| Pattern not found | "Pattern 'XXX' not found in knowledge base" | Use valid pattern ID |

---

## Testing

### MCP Inspector

```bash
cd mcp-server
npm run build
npx @modelcontextprotocol/inspector
```

### Test Cases

| Tool | Test Case | Expected |
|------|-----------|----------|
| read_project_context | Valid project key | Returns context with issues |
| read_project_context | Invalid project key | Returns helpful error |
| read_project_context | No Jira config | Uses mock data |
| generate_architecture | Healthcare + HIPAA | Returns agent pattern with HIPAA considerations |
| generate_architecture | Batch keywords | Returns batch_processing pattern |
| assess_compliance | Healthcare industry | Returns HIPAA as required |
| create_implementation_plan | Medium complexity | Returns ~14 week plan |

---

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.2",
    "zod": "^3.22.4",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "tsx": "^4.6.2",
    "typescript": "^5.3.2"
  }
}
```

---

## Build & Run

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run (stdio transport)
npm start

# Run (HTTP transport)
TRANSPORT=http PORT=3000 npm start

# Development with watch
npm run dev

# Test with inspector
npm run inspect
```

---

## File-by-File Implementation Checklist

### src/index.ts
- [ ] Import MCP SDK and dependencies
- [ ] Initialize McpServer with name and version
- [ ] Register all 4 tools with registerTool()
- [ ] Implement tool handlers
- [ ] Set up stdio and HTTP transport options
- [ ] Handle errors gracefully

### src/schemas/index.ts
- [ ] Define enums (IndustryVertical, CloudProvider, etc.)
- [ ] Define ProjectContextSchema
- [ ] Define input schemas for all 4 tools
- [ ] Define output schemas for structured responses
- [ ] Export TypeScript types with z.infer

### src/services/jiraClient.ts
- [ ] Implement JiraClient class with Axios
- [ ] Implement MockJiraClient with demo data
- [ ] Create factory function to select client
- [ ] Handle authentication errors
- [ ] Provide realistic mock data for HEALTH project

### src/services/knowledgeBase.ts
- [ ] Implement lazy loading of JSON files
- [ ] Implement compliance methods
- [ ] Implement architecture methods
- [ ] Implement industry methods
- [ ] Create singleton instance

### src/knowledge/architectures.json
- [ ] Define 4 architecture patterns
- [ ] Include components, data flow, diagrams
- [ ] Add pattern selection criteria

### src/knowledge/compliance.json
- [ ] Define HIPAA framework in detail
- [ ] Define SOC2 framework
- [ ] Define FedRAMP framework
- [ ] Add compliance matrix for use cases

### src/knowledge/industries.json
- [ ] Define healthcare vertical in detail
- [ ] Add common use cases with recommendations
- [ ] Include integration patterns
- [ ] Add stakeholder mappings
