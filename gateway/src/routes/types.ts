import type { GatewayProxyEngine } from "../proxy/engine.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

/**
 * Shared state passed to all route modules so they can access
 * the per-tenant engine map and MCP transport map.
 */
export interface GatewayState {
  engines: Map<string, GatewayProxyEngine>;
  mcpTransports: Map<string, StreamableHTTPServerTransport>;
  transportLastActivity: Map<string, number>;
  allowedOrigins: string[];
  getOrCreateEngine: (
    tenantId: string,
    tenantContext: import("../auth/types.js").AuthenticatedRequest["tenant"]
  ) => Promise<GatewayProxyEngine>;
  safeErrorMessage: (error: unknown) => string;
}
