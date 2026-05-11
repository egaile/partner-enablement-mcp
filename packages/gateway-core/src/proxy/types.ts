/**
 * Cross-cutting types for the proxy subsystem.
 *
 * Kept here (not in storage/types.ts) because they describe in-memory
 * request-time state, not persisted records.
 */

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

/**
 * Identifies the caller behind a tool-call request.
 *
 * Self-host deployments have a single implicit tenant and a single user.
 * Cloud deployments populate this from the auth middleware.
 */
export interface TenantContext {
  tenantId: string;
  tenantName: string;
  userId: string;
  userRole: string;
  plan?: string;
}

/**
 * A live connection to one downstream MCP server plus its discovered tools.
 *
 * `tools` is built from the SDK's `listTools()` response at connect time and
 * is re-used for namespaced lookup and drift detection.
 */
export interface DownstreamConnection {
  client: Client;
  serverId: string;
  serverName: string;
  tools: Map<
    string,
    {
      name: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
    }
  >;
}

/**
 * Result of running a tool call through the security pipeline.
 *
 * `response` is the message that should be returned to the MCP client —
 * either the downstream server's response or a gateway-generated block.
 */
export interface InterceptResult {
  allowed: boolean;
  response?: {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
  correlationId: string;
}
