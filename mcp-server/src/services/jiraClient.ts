import axios, { AxiosInstance, AxiosError } from "axios";

export interface JiraProject {
  key: string;
  name: string;
  description?: string;
  projectTypeKey: string;
  lead?: {
    displayName: string;
    emailAddress: string;
  };
}

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: {
      name: string;
    };
    status: {
      name: string;
    };
    labels: string[];
    created: string;
    updated: string;
    priority?: {
      name: string;
    };
    customFields?: Record<string, unknown>;
  };
}

export interface JiraSearchResult {
  total: number;
  issues: JiraIssue[];
}

export interface JiraClientConfig {
  host: string;
  email: string;
  apiToken: string;
}

export class JiraClient {
  private client: AxiosInstance;
  private config: JiraClientConfig;

  constructor(config?: Partial<JiraClientConfig>) {
    this.config = {
      host: config?.host || process.env.JIRA_HOST || "",
      email: config?.email || process.env.JIRA_EMAIL || "",
      apiToken: config?.apiToken || process.env.JIRA_API_TOKEN || ""
    };

    const auth = Buffer.from(
      `${this.config.email}:${this.config.apiToken}`
    ).toString("base64");

    this.client = axios.create({
      baseURL: `https://${this.config.host}/rest/api/3`,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      timeout: 30000
    });
  }

  isConfigured(): boolean {
    return !!(this.config.host && this.config.email && this.config.apiToken);
  }

  async getProject(projectKey: string): Promise<JiraProject> {
    try {
      const response = await this.client.get<JiraProject>(
        `/project/${projectKey}`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
          throw new Error(`Project '${projectKey}' not found`);
        }
        if (axiosError.response?.status === 401) {
          throw new Error("Jira authentication failed - check credentials");
        }
        throw new Error(
          `Jira API error: ${axiosError.response?.status} - ${axiosError.message}`
        );
      }
      throw error;
    }
  }

  async searchIssues(
    projectKey: string,
    options: {
      maxResults?: number;
      issueTypes?: string[];
      labels?: string[];
      orderBy?: string;
    } = {}
  ): Promise<JiraSearchResult> {
    const {
      maxResults = 10,
      issueTypes,
      labels,
      orderBy = "updated DESC"
    } = options;

    let jql = `project = "${projectKey}"`;
    
    if (issueTypes && issueTypes.length > 0) {
      jql += ` AND issuetype IN (${issueTypes.map(t => `"${t}"`).join(", ")})`;
    }
    
    if (labels && labels.length > 0) {
      jql += ` AND labels IN (${labels.map(l => `"${l}"`).join(", ")})`;
    }
    
    jql += ` ORDER BY ${orderBy}`;

    try {
      const response = await this.client.post<JiraSearchResult>("/search", {
        jql,
        maxResults,
        fields: [
          "summary",
          "description",
          "issuetype",
          "status",
          "labels",
          "created",
          "updated",
          "priority"
        ]
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        throw new Error(
          `Jira search failed: ${axiosError.response?.status} - ${axiosError.message}`
        );
      }
      throw error;
    }
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const response = await this.client.get<JiraIssue>(`/issue/${issueKey}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
          throw new Error(`Issue '${issueKey}' not found`);
        }
        throw new Error(
          `Jira API error: ${axiosError.response?.status} - ${axiosError.message}`
        );
      }
      throw error;
    }
  }

  async getProjectLabels(projectKey: string): Promise<string[]> {
    // Get unique labels from recent issues
    const result = await this.searchIssues(projectKey, { maxResults: 50 });
    const labels = new Set<string>();
    
    for (const issue of result.issues) {
      for (const label of issue.fields.labels) {
        labels.add(label);
      }
    }
    
    return Array.from(labels).sort();
  }
}

// Mock client for demo purposes when Jira is not configured
export class MockJiraClient {
  async getProject(projectKey: string): Promise<JiraProject> {
    return getMockProject(projectKey);
  }

  async searchIssues(
    projectKey: string,
    options: { maxResults?: number } = {}
  ): Promise<JiraSearchResult> {
    const issues = getMockIssues(projectKey);
    return {
      total: issues.length,
      issues: issues.slice(0, options.maxResults || 10)
    };
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const projectKey = issueKey.split("-")[0];
    const issues = getMockIssues(projectKey);
    const issue = issues.find(i => i.key === issueKey);
    if (!issue) {
      throw new Error(`Issue '${issueKey}' not found`);
    }
    return issue;
  }

  async getProjectLabels(projectKey: string): Promise<string[]> {
    const issues = getMockIssues(projectKey);
    const labels = new Set<string>();
    for (const issue of issues) {
      for (const label of issue.fields.labels) {
        labels.add(label);
      }
    }
    return Array.from(labels).sort();
  }

  isConfigured(): boolean {
    return true;
  }
}

// Mock data for demo
function getMockProject(projectKey: string): JiraProject {
  const projects: Record<string, JiraProject> = {
    HEALTH: {
      key: "HEALTH",
      name: "Healthcare AI Assistant",
      description: "AI-powered patient intake and benefits navigation system for regional health network",
      projectTypeKey: "software",
      lead: {
        displayName: "Sarah Chen",
        emailAddress: "schen@healthnetwork.example"
      }
    },
    CLAIMS: {
      key: "CLAIMS",
      name: "Claims Processing Automation",
      description: "Intelligent claims review and processing system with human-in-the-loop validation",
      projectTypeKey: "software",
      lead: {
        displayName: "Michael Torres",
        emailAddress: "mtorres@healthpayer.example"
      }
    }
  };

  return projects[projectKey] || {
    key: projectKey,
    name: `Project ${projectKey}`,
    description: "Demo project for partner enablement",
    projectTypeKey: "software"
  };
}

function getMockIssues(projectKey: string): JiraIssue[] {
  const healthcareIssues: JiraIssue[] = [
    {
      key: "HEALTH-1",
      fields: {
        summary: "Patient Intake Conversational Flow",
        description: "Design and implement conversational AI flow for gathering patient information before appointments. Must integrate with Epic EHR via FHIR APIs. Need to handle: demographics, insurance verification, reason for visit, and medical history updates.",
        issuetype: { name: "Epic" },
        status: { name: "In Progress" },
        labels: ["hipaa", "phi", "patient-facing", "epic-integration"],
        created: "2024-01-15T10:00:00.000Z",
        updated: "2024-02-01T14:30:00.000Z",
        priority: { name: "High" }
      }
    },
    {
      key: "HEALTH-2",
      fields: {
        summary: "Benefits Navigator RAG System",
        description: "Implement retrieval-augmented generation system to answer patient questions about their insurance benefits. Must ingest plan documents and provide accurate, cited responses. Include escalation path to human agents for complex questions.",
        issuetype: { name: "Epic" },
        status: { name: "To Do" },
        labels: ["hipaa", "rag", "patient-facing", "benefits"],
        created: "2024-01-20T09:00:00.000Z",
        updated: "2024-01-25T11:00:00.000Z",
        priority: { name: "Medium" }
      }
    },
    {
      key: "HEALTH-3",
      fields: {
        summary: "HIPAA Compliance Infrastructure",
        description: "Set up compliant infrastructure including: encryption at rest and in transit, audit logging, access controls, BAA with Claude API provider. Implement PHI handling procedures and data retention policies.",
        issuetype: { name: "Epic" },
        status: { name: "To Do" },
        labels: ["hipaa", "infrastructure", "security", "compliance"],
        created: "2024-01-22T08:00:00.000Z",
        updated: "2024-01-22T08:00:00.000Z",
        priority: { name: "Critical" }
      }
    },
    {
      key: "HEALTH-4",
      fields: {
        summary: "Multi-language Support",
        description: "Implement Spanish and Vietnamese language support for patient-facing interfaces. Must maintain medical terminology accuracy and cultural sensitivity.",
        issuetype: { name: "Story" },
        status: { name: "To Do" },
        labels: ["patient-facing", "accessibility", "i18n"],
        created: "2024-01-25T10:00:00.000Z",
        updated: "2024-01-25T10:00:00.000Z",
        priority: { name: "Medium" }
      }
    },
    {
      key: "HEALTH-5",
      fields: {
        summary: "Human Handoff Workflow",
        description: "Design workflow for seamless handoff from AI to human agents. Include context transfer, urgency detection, and escalation triggers for medical concerns.",
        issuetype: { name: "Story" },
        status: { name: "In Progress" },
        labels: ["patient-facing", "human-in-loop", "workflow"],
        created: "2024-01-28T11:00:00.000Z",
        updated: "2024-02-02T09:00:00.000Z",
        priority: { name: "High" }
      }
    }
  ];

  const claimsIssues: JiraIssue[] = [
    {
      key: "CLAIMS-1",
      fields: {
        summary: "Intelligent Claims Review Pipeline",
        description: "Build batch processing pipeline for AI-assisted claims review. Must handle high volumes (50k+ claims/day) with human review queue for edge cases and exceptions.",
        issuetype: { name: "Epic" },
        status: { name: "In Progress" },
        labels: ["hipaa", "batch-processing", "claims", "phi"],
        created: "2024-01-10T10:00:00.000Z",
        updated: "2024-02-01T16:00:00.000Z",
        priority: { name: "High" }
      }
    },
    {
      key: "CLAIMS-2",
      fields: {
        summary: "Human Review Interface",
        description: "Design reviewer interface showing AI recommendations, confidence scores, and supporting evidence. Reviewers must be able to approve, modify, or reject with documented rationale.",
        issuetype: { name: "Epic" },
        status: { name: "To Do" },
        labels: ["human-in-loop", "ui", "reviewer-tools"],
        created: "2024-01-12T09:00:00.000Z",
        updated: "2024-01-15T11:00:00.000Z",
        priority: { name: "High" }
      }
    }
  ];

  if (projectKey === "HEALTH") {
    return healthcareIssues;
  } else if (projectKey === "CLAIMS") {
    return claimsIssues;
  }
  
  return healthcareIssues; // Default to healthcare for demo
}

// Factory function to get appropriate client
export function createJiraClient(config?: Partial<JiraClientConfig>): JiraClient | MockJiraClient {
  const client = new JiraClient(config);
  if (client.isConfigured()) {
    return client;
  }
  console.error("Jira not configured - using mock data for demo");
  return new MockJiraClient();
}
