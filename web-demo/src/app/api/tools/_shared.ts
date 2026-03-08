import { z } from 'zod';
import { KnowledgeBase } from 'partner-enablement-mcp-server/services/knowledgeBase';
import compliance from 'partner-enablement-mcp-server/knowledge/compliance.json';
import architectures from 'partner-enablement-mcp-server/knowledge/architectures.json';
import industries from 'partner-enablement-mcp-server/knowledge/industries.json';

export const knowledgeBase = new KnowledgeBase({
  compliance: compliance as Record<string, unknown>,
  architectures: architectures as Record<string, unknown>,
  industries: industries as Record<string, unknown>,
});

/** Gateway integration config — when set, read-context uses Rovo via the gateway */
export const GATEWAY_URL = process.env.GATEWAY_URL ?? '';
export const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY ?? '';
export const ROVO_SERVER_NAME = process.env.ROVO_SERVER_NAME ?? 'atlassian-rovo';

/** Shared Zod schemas for API route input validation */
export const ProjectKeySchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,9}$/).default('HEALTH');

export const TicketInputSchema = z.object({
  summary: z.string().max(255),
  description: z.string().max(32767),
  type: z.string().max(50),
}).strict();

export const AgentActionsInputSchema = z.object({
  projectKey: ProjectKeySchema,
  enabledActions: z.array(z.string().max(50)).max(10),
  issueKey: z.string().regex(/^[A-Z][A-Z0-9_]{0,9}-\d+$/).optional(),
  architectureTitle: z.string().max(255).optional(),
  architectureContent: z.string().max(100000).optional(),
  jiraTickets: z.array(TicketInputSchema).max(10).optional(),
}).strict();

export const CreateIssuesInputSchema = z.object({
  projectKey: ProjectKeySchema,
  tickets: z.array(TicketInputSchema).max(5).default([]),
}).strict();

export const IssueDetailInputSchema = z.object({
  issueKey: z.string().regex(/^[A-Z][A-Z0-9_]{0,9}-\d+$/),
  cloudId: z.string().max(100).optional(),
}).strict();
