/**
 * GatewayProxyEngine — composes the proxy subsystem behind a single MCP
 * `Server` instance.
 *
 * One engine instance serves one tenant (multi-tenant deployments map
 * tenant → engine in the caller). Each connecting MCP client creates its
 * own session-scoped Server via `createSessionServer()` but all sessions
 * share the same downstream connections, interceptor, audit recorder, etc.
 *
 * Cloud-only concerns (alerts, billing, OAuth, Atlassian audit enrichment)
 * are injected as `ports.ts` adapters. Self-host gets sensible no-ops.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { StorageBackend, McpServerRecord } from "../storage/types.js";
import type { PromptInjectionScanner } from "../security/scanner.js";
import type { PolicyEngine } from "../policy/engine.js";
import type { DriftDetector } from "../monitor/tool-snapshot.js";
import { ConnectionManager } from "./connection-manager.js";
import { ToolInterceptor } from "./tool-interceptor.js";
import { HealthChecker } from "./health-checker.js";
import type {
  AlertSink,
  AuditRecorder,
  BillingGuard,
  OAuthProviderFactory,
} from "./ports.js";
import { noopAlertSink } from "./ports.js";
import type { TenantContext } from "./types.js";

export interface GatewayProxyEngineOptions {
  storage: StorageBackend;
  policyEngine: PolicyEngine;
  driftDetector: DriftDetector;
  scanner: PromptInjectionScanner;
  auditRecorder: AuditRecorder;
  alertSink?: AlertSink;
  billingGuard?: BillingGuard;
  oauthFactory?: OAuthProviderFactory;
  /** Health check polling interval. Pass 0 to disable health checking. */
  healthCheckIntervalMs?: number;
  /** Advertised on the MCP server handshake. */
  serverName?: string;
  serverVersion?: string;
}

export class GatewayProxyEngine {
  private readonly storage: StorageBackend;
  private readonly connectionManager: ConnectionManager;
  private readonly interceptor: ToolInterceptor;
  private readonly policyEngine: PolicyEngine;
  private readonly alertSink: AlertSink;
  private readonly healthCheckIntervalMs: number;
  private readonly serverName: string;
  private readonly serverVersion: string;
  private healthChecker: HealthChecker | null = null;
  private tenantContext: TenantContext | null = null;

  constructor(options: GatewayProxyEngineOptions) {
    this.storage = options.storage;
    this.policyEngine = options.policyEngine;
    this.alertSink = options.alertSink ?? noopAlertSink;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs ?? 60_000;
    this.serverName = options.serverName ?? "mcp-security-gateway";
    this.serverVersion = options.serverVersion ?? "0.1.0";

    this.connectionManager = new ConnectionManager({
      oauthFactory: options.oauthFactory,
      clientName: this.serverName,
      clientVersion: this.serverVersion,
    });

    this.interceptor = new ToolInterceptor({
      policyEngine: options.policyEngine,
      driftDetector: options.driftDetector,
      scanner: options.scanner,
      auditRecorder: options.auditRecorder,
      alertSink: options.alertSink,
      billingGuard: options.billingGuard,
    });
  }

  setTenantContext(ctx: TenantContext): void {
    this.tenantContext = ctx;
  }

  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  getHealthChecker(): HealthChecker | null {
    return this.healthChecker;
  }

  clearPolicyCache(tenantId?: string): void {
    this.policyEngine.clearCache(tenantId);
  }

  /**
   * Create a session-scoped MCP `Server`. Each connecting client gets its
   * own Server, but all sessions share the engine's downstream connections
   * and interceptor.
   */
  createSessionServer(): Server {
    const server = new Server(
      { name: this.serverName, version: this.serverVersion },
      { capabilities: { tools: {} } }
    );

    this.registerHandlers(server);
    return server;
  }

  async connectDownstreamServers(tenantId: string): Promise<void> {
    const servers = await this.storage.servers.listEnabledForTenant(tenantId);
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
        this.alertSink
          .fireServerError(tenantId, {
            serverId: servers[i].id,
            serverName: servers[i].name,
            errorMessage: String(result.reason),
            errorType: "connection_failure",
          })
          .catch((err) =>
            console.error("[alert] Failed to fire server error alert:", err)
          );
      }
    }

    if (this.healthCheckIntervalMs > 0) {
      this.healthChecker = new HealthChecker({
        connectionManager: this.connectionManager,
        alertSink: this.alertSink,
        tenantId,
        intervalMs: this.healthCheckIntervalMs,
      });
      this.healthChecker.start();
    }
  }

  async connectServer(server: McpServerRecord): Promise<void> {
    await this.connectionManager.connect(server);
  }

  /**
   * Tear down per-engine resources. Caller is responsible for flushing any
   * audit logger / usage meter they injected.
   */
  async shutdown(): Promise<void> {
    this.healthChecker?.stop();
    this.interceptor.stop();
    await this.connectionManager.disconnectAll();
  }

  private registerHandlers(server: Server): void {
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
