import { KnowledgeBase } from 'partner-enablement-mcp-server/services/knowledgeBase';
import { createJiraClient, MockJiraClient } from 'partner-enablement-mcp-server/services/jiraClient';
import compliance from 'partner-enablement-mcp-server/knowledge/compliance.json';
import architectures from 'partner-enablement-mcp-server/knowledge/architectures.json';
import industries from 'partner-enablement-mcp-server/knowledge/industries.json';

export const knowledgeBase = new KnowledgeBase({
  compliance: compliance as Record<string, unknown>,
  architectures: architectures as Record<string, unknown>,
  industries: industries as Record<string, unknown>,
});

const realClient = createJiraClient();
const mockClient = new MockJiraClient();

// Wrapper that tries real Jira first, falls back to mock for projects
// that don't exist on the live instance (e.g. FINSERV is demo-only)
export const jiraClient = {
  async getProject(projectKey: string) {
    try {
      return await realClient.getProject(projectKey);
    } catch {
      return mockClient.getProject(projectKey);
    }
  },
  async searchIssues(projectKey: string, options: { maxResults?: number } = {}) {
    try {
      return await realClient.searchIssues(projectKey, options);
    } catch {
      return mockClient.searchIssues(projectKey, options);
    }
  },
  async getIssue(issueKey: string) {
    try {
      return await realClient.getIssue(issueKey);
    } catch {
      return mockClient.getIssue(issueKey);
    }
  },
  async getProjectLabels(projectKey: string) {
    try {
      return await realClient.getProjectLabels(projectKey);
    } catch {
      return mockClient.getProjectLabels(projectKey);
    }
  },
  isConfigured() {
    return realClient.isConfigured();
  },
};
