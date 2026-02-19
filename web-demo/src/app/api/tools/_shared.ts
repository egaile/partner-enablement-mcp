import { KnowledgeBase } from 'partner-enablement-mcp-server/services/knowledgeBase';
import { MockJiraClient } from 'partner-enablement-mcp-server/services/jiraClient';
import compliance from 'partner-enablement-mcp-server/knowledge/compliance.json';
import architectures from 'partner-enablement-mcp-server/knowledge/architectures.json';
import industries from 'partner-enablement-mcp-server/knowledge/industries.json';

export const knowledgeBase = new KnowledgeBase({
  compliance: compliance as Record<string, unknown>,
  architectures: architectures as Record<string, unknown>,
  industries: industries as Record<string, unknown>,
});

// Web demo always uses mock data — demo project keys (HEALTH, FINSERV)
// don't exist in real Jira instances.
export const jiraClient = new MockJiraClient();
