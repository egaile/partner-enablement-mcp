import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const knowledgePath = join(__dirname, "..", "knowledge");

// Types for knowledge base content
export interface ComplianceFrameworkData {
  name: string;
  fullName: string;
  applicableWhen: string[];
  keyRequirements: Record<string, {
    title: string;
    items: string[];
  }>;
  architectureImplications: Record<string, {
    requirement: string;
    implementation: string[];
  }>;
  baaRequirements?: {
    description: string;
    mustInclude: string[];
    anthropicNote: string;
  };
}

export interface ArchitecturePatternData {
  name: string;
  description: string;
  useCases: string[];
  components: Record<string, {
    description: string;
    services: {
      aws: string[];
      gcp: string[];
      anthropic?: string[];
    };
  }>;
  dataFlow: string[];
  mermaidDiagram: string;
  securityConsiderations: string[];
  scalingConsiderations?: string[];
  humanInTheLoop?: {
    required: boolean;
    implementation: string[];
  };
}

export interface IndustryUseCaseData {
  name: string;
  description: string;
  recommendedPattern: string;
  complianceNotes: string[];
  technicalConsiderations?: string[];
  estimatedComplexity: string;
  typicalTimeline: string;
}

export interface IndustryData {
  name: string;
  description: string;
  regulatoryContext: {
    primary: string[];
    secondary: string[];
    emerging: string[];
  };
  commonUseCases: Record<string, {
    name: string;
    examples: IndustryUseCaseData[];
  }>;
  integrationPatterns?: Record<string, {
    name: string;
    standards: string[];
    vendors?: string[];
    considerations: string[];
  }>;
  stakeholders: Record<string, string[]>;
}

// Lazy loading of knowledge base
let complianceData: Record<string, unknown> | null = null;
let architecturesData: Record<string, unknown> | null = null;
let industriesData: Record<string, unknown> | null = null;

function loadComplianceData(): Record<string, unknown> {
  if (!complianceData) {
    const content = readFileSync(join(knowledgePath, "compliance.json"), "utf-8");
    complianceData = JSON.parse(content);
  }
  return complianceData;
}

function loadArchitecturesData(): Record<string, unknown> {
  if (!architecturesData) {
    const content = readFileSync(join(knowledgePath, "architectures.json"), "utf-8");
    architecturesData = JSON.parse(content);
  }
  return architecturesData;
}

function loadIndustriesData(): Record<string, unknown> {
  if (!industriesData) {
    const content = readFileSync(join(knowledgePath, "industries.json"), "utf-8");
    industriesData = JSON.parse(content);
  }
  return industriesData;
}

export class KnowledgeBase {
  // Compliance methods
  getComplianceFramework(frameworkId: string): ComplianceFrameworkData | null {
    const data = loadComplianceData();
    const frameworks = data.frameworks as Record<string, ComplianceFrameworkData>;
    return frameworks[frameworkId] || null;
  }

  getApplicableFrameworks(industry: string, dataTypes: string[]): string[] {
    const data = loadComplianceData();
    const matrix = data.complianceMatrix as Record<string, {
      requiredFrameworks: string[];
      recommendedFrameworks: string[];
    }>;

    const applicable = new Set<string>();

    // Add industry-specific requirements
    const industryData = loadIndustriesData();
    const industries = industryData.industries as Record<string, IndustryData>;
    const industryInfo = industries[industry];
    
    if (industryInfo) {
      industryInfo.regulatoryContext.primary.forEach(f => 
        applicable.add(f.toLowerCase())
      );
    }

    // Add data-type specific requirements
    if (dataTypes.includes("PHI") || dataTypes.includes("phi")) {
      applicable.add("hipaa");
    }
    if (dataTypes.includes("PII") || dataTypes.includes("pii")) {
      applicable.add("soc2");
    }
    if (dataTypes.includes("financial") || dataTypes.includes("payment")) {
      applicable.add("pci_dss");
      applicable.add("soc2");
    }

    return Array.from(applicable);
  }

  getComplianceRequirements(frameworks: string[]): Array<{
    framework: string;
    category: string;
    requirement: string;
    implementation: string;
    priority: string;
  }> {
    const requirements: Array<{
      framework: string;
      category: string;
      requirement: string;
      implementation: string;
      priority: string;
    }> = [];

    for (const frameworkId of frameworks) {
      const framework = this.getComplianceFramework(frameworkId);
      if (!framework) continue;

      // Add architecture implications as requirements
      for (const [category, impl] of Object.entries(framework.architectureImplications)) {
        requirements.push({
          framework: frameworkId,
          category,
          requirement: impl.requirement,
          implementation: impl.implementation.join("; "),
          priority: category === "llmSpecific" ? "critical" : "high"
        });
      }
    }

    return requirements;
  }

  // Architecture methods
  getArchitecturePattern(patternId: string): ArchitecturePatternData | null {
    const data = loadArchitecturesData();
    const patterns = data.patterns as Record<string, ArchitecturePatternData>;
    return patterns[patternId] || null;
  }

  getAllPatterns(): Record<string, ArchitecturePatternData> {
    const data = loadArchitecturesData();
    return data.patterns as Record<string, ArchitecturePatternData>;
  }

  getPatternSelection(): Record<string, { choose_when: string[] }> {
    const data = loadArchitecturesData();
    const selection = data.patternSelection as { criteria: Record<string, { choose_when: string[] }> };
    return selection.criteria;
  }

  recommendPattern(useCase: string, requirements: string[]): string {
    const criteria = this.getPatternSelection();
    
    // Simple keyword matching for pattern recommendation
    const useCaseLower = useCase.toLowerCase();
    const reqsLower = requirements.map(r => r.toLowerCase());

    // Check for human-in-the-loop indicators
    if (
      useCaseLower.includes("clinical") ||
      useCaseLower.includes("decision") ||
      useCaseLower.includes("approval") ||
      reqsLower.some(r => r.includes("human review") || r.includes("oversight"))
    ) {
      return "human_in_the_loop";
    }

    // Check for batch processing indicators
    if (
      useCaseLower.includes("batch") ||
      useCaseLower.includes("processing") ||
      useCaseLower.includes("high volume") ||
      reqsLower.some(r => r.includes("async") || r.includes("bulk"))
    ) {
      return "batch_processing";
    }

    // Check for RAG indicators
    if (
      useCaseLower.includes("document") ||
      useCaseLower.includes("search") ||
      useCaseLower.includes("qa") ||
      useCaseLower.includes("knowledge base") ||
      reqsLower.some(r => r.includes("citation") || r.includes("reference"))
    ) {
      return "rag_document_qa";
    }

    // Default to conversational agent
    return "conversational_agent";
  }

  // Industry methods
  getIndustry(industryId: string): IndustryData | null {
    const data = loadIndustriesData();
    const industries = data.industries as Record<string, IndustryData>;
    return industries[industryId] || null;
  }

  getIndustryUseCases(industryId: string): IndustryUseCaseData[] {
    const industry = this.getIndustry(industryId);
    if (!industry) return [];

    const useCases: IndustryUseCaseData[] = [];
    for (const category of Object.values(industry.commonUseCases)) {
      useCases.push(...category.examples);
    }
    return useCases;
  }

  matchUseCase(
    industryId: string,
    description: string
  ): IndustryUseCaseData | null {
    const useCases = this.getIndustryUseCases(industryId);
    const descLower = description.toLowerCase();

    // Simple keyword matching
    for (const useCase of useCases) {
      const nameWords = useCase.name.toLowerCase().split(" ");
      const matches = nameWords.filter(word => 
        descLower.includes(word) && word.length > 3
      );
      if (matches.length >= 2) {
        return useCase;
      }
    }

    return null;
  }

  getIntegrationPatterns(industryId: string): Record<string, {
    name: string;
    standards: string[];
    vendors?: string[];
    considerations: string[];
  }> | null {
    const industry = this.getIndustry(industryId);
    return industry?.integrationPatterns || null;
  }

  getStakeholders(industryId: string): Record<string, string[]> | null {
    const industry = this.getIndustry(industryId);
    return industry?.stakeholders || null;
  }
}

// Singleton instance
export const knowledgeBase = new KnowledgeBase();
