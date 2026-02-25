import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ConnectionManager } from "./connection-manager.js";
import { ToolInterceptor } from "./tool-interceptor.js";
import { PolicyEngine } from "../policy/engine.js";
import { AuditLogger } from "../audit/logger.js";
import { AlertEngine } from "../alerts/engine.js";
import {
  getEnabledServersForTenant,
  type McpServerRecord,
} from "../db/queries/servers.js";
import type { TenantContext } from "../auth/types.js";

/**
 * GatewayProxyEngine manages shared resources (downstream connections, policy, audit)
 * for a tenant, and creates per-session MCP Server instances that delegate to
 * those shared resources.
 */
export class GatewayProxyEngine {
  private connectionManager: ConnectionManager;
  private interceptor: ToolInterceptor;
  private policyEngine: PolicyEngine;
  private auditLogger: AuditLogger;
  private alertEngine: AlertEngine;

  // Track which tenant this engine instance serves
  private tenantContext: TenantContext | null = null;

  constructor() {
    this.connectionManager = new ConnectionManager();
    this.policyEngine = new PolicyEngine();
    this.auditLogger = new AuditLogger();
    this.alertEngine = new AlertEngine();
    this.interceptor = new ToolInterceptor(
      this.policyEngine,
      this.auditLogger,
      this.alertEngine
    );
  }

  setTenantContext(ctx: TenantContext): void {
    this.tenantContext = ctx;
  }

  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  /**
   * Create a new MCP Server for a client session.
   * Each session gets its own Server instance, but they all share
   * the same downstream connections, interceptor, and audit logger.
   */
  createSessionServer(): Server {
    const server = new Server(
      { name: "mcp-security-gateway", version: "0.1.0" },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerHandlers(server);
    return server;
  }

  /**
   * Connect to all enabled downstream servers for a tenant.
   */
  async connectDownstreamServers(tenantId: string): Promise<void> {
    const servers = await getEnabledServersForTenant(tenantId);
    console.log(
      `[gateway] Connecting to ${servers.length} downstream server(s) for tenant ${tenantId}`
    );

    const results = await Promise.allSettled(
      servers.map((s) => this.connectionManager.connect(s))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "rejected") {
        console.error(
          `[gateway] Failed to connect to "${servers[i].name}": ${result.reason}`
        );
      }
    }
  }

  /**
   * Connect to a single downstream server.
   */
  async connectServer(server: McpServerRecord): Promise<void> {
    await this.connectionManager.connect(server);
  }

  async shutdown(): Promise<void> {
    await this.auditLogger.flush();
    this.auditLogger.stop();
    await this.connectionManager.disconnectAll();
  }

  private registerHandlers(server: Server): void {
    // Handle tools/list — aggregate from all downstream servers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Array<{
        name: string;
        description?: string;
        inputSchema: Record<string, unknown>;
      }> = [];

      for (const conn of this.connectionManager.getAllConnections()) {
        for (const [, toolDef] of conn.tools) {
          tools.push({
            name: `${conn.serverName}__${toolDef.name}`,
            description: toolDef.description
              ? `[${conn.serverName}] ${toolDef.description}`
              : `Tool from ${conn.serverName}`,
            inputSchema: toolDef.inputSchema ?? {
              type: "object",
              properties: {},
            },
          });
        }
      }

      return { tools };
    });

    // Handle tools/call — run through security pipeline
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!this.tenantContext) {
        return {
          content: [
            {
              type: "text",
              text: "Gateway error: no tenant context established",
            },
          ],
          isError: true,
        };
      }

      // Resolve namespaced tool
      const resolved = this.connectionManager.resolveNamespacedTool(name);
      if (!resolved) {
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: "${name}". Use tools/list to see available tools.`,
            },
          ],
          isError: true,
        };
      }

      // Run through security pipeline
      const result = await this.interceptor.intercept(
        this.tenantContext,
        resolved.connection,
        resolved.toolName,
        (args as Record<string, unknown>) ?? {}
      );

      if (result.response) {
        return result.response;
      }

      return {
        content: [
          { type: "text", text: "No response from downstream server" },
        ],
        isError: true,
      };
    });
  }
}
