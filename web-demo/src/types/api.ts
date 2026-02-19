// TypeScript interfaces for all API responses

export interface ProjectContextData {
  project: {
    key: string;
    name: string;
    description?: string;
    lead?: string;
  };
  issues: Issue[];
  detectedCompliance: string[];
  detectedIntegrations: string[];
  detectedDataTypes: string[];
  allLabels: string[];
  summary: {
    totalIssues: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

export interface Issue {
  key: string;
  summary: string;
  description?: string;
  type: string;
  status: string;
  labels: string[];
  priority?: string;
}

export interface ArchitectureData {
  pattern: string;
  patternName: string;
  rationale: string;
  components: ArchitectureComponent[];
  dataFlow: string[];
  mermaidDiagram?: string;
  securityConsiderations: string[];
  scalingConsiderations: string[];
  alternatives?: Array<{
    pattern: string;
    rationale: string;
  }>;
}

export interface ArchitectureComponent {
  name: string;
  description: string;
  services: Record<string, string[]>;
  considerations: string[];
}

export interface ComplianceData {
  applicableFrameworks: ComplianceFramework[];
  keyRequirements: ComplianceRequirement[];
  riskAreas: RiskArea[];
  checklist?: ChecklistItem[];
}

export interface ComplianceFramework {
  framework: string;
  name: string;
  applicabilityReason: string;
  priority: 'required' | 'recommended';
}

export interface ComplianceRequirement {
  category: string;
  requirement: string;
  implementation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface RiskArea {
  area: string;
  risk: string;
  mitigation: string;
}

export interface ChecklistItem {
  item: string;
  category: string;
  completed: boolean;
}

export interface PlanData {
  summary: {
    totalWeeks: number;
    totalSprints: number;
    teamSize: number;
    phases: number;
  };
  phases: Phase[];
  skillRequirements: SkillRequirement[];
  jiraTickets?: JiraTicket[];
}

export interface Phase {
  name: string;
  description: string;
  durationWeeks: number;
  sprints: Array<{
    number: number;
    focus: string;
    deliverables: string[];
  }>;
  milestones: string[];
  riskFactors: string[];
}

export interface SkillRequirement {
  skill: string;
  level: string;
  roles: string[];
}

export interface JiraTicket {
  type: 'epic' | 'story' | 'task';
  summary: string;
  description: string;
  labels: string[];
  estimateHours?: number;
}

export type Step = 'select' | 'context' | 'architecture' | 'compliance' | 'plan' | 'complete';
export type Industry = 'healthcare' | 'financial';

export interface DemoState {
  selectedIndustry: Industry | null;
  currentStep: Step;
  isGenerating: boolean;
  error: string | null;
  data: {
    context: ProjectContextData | null;
    architecture: ArchitectureData | null;
    compliance: ComplianceData | null;
    plan: PlanData | null;
  };
}
