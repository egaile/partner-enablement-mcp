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
