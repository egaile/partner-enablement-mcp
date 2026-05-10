/**
 * ConnectionManager — owns the live MCP client connections to every downstream
 * server registered for a tenant.
 *
 * Responsibilities:
 *   - Open a stdio or HTTP transport per server record
 *   - Wire optional OAuth providers via `OAuthProviderFactory`
 *   - Discover the downstream `tools/list` at connect time
 *   - Resolve `serverName__toolName` lookups back to the originating connection
 *
 * Server records are read-only here — persistence of OAuth tokens belongs to
 * whichever provider the OAuthProviderFactory returns.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { McpServerRecord } from "../storage/types.js";
import type { OAuthProviderFactory } from "./ports.js";
import type { DownstreamConnection } from "./types.js";

export interface ConnectionManagerOptions {
  /** Builds an OAuth provider per server record. Omit for static-auth only. */
  oauthFactory?: OAuthProviderFactory;
  /** Client identification advertised on the MCP handshake. */
  clientName?: string;
  clientVersion?: string;
}

export class ConnectionManager {
  private connections = new Map<string, DownstreamConnection>();
  private serverRecords = new Map<string, McpServerRecord>();
  /** OAuth providers keyed by serverId — reused across reconnects. */
  private oauthProviders = new Map<string, OAuthClientProvider>();
  private readonly oauthFactory: OAuthProviderFactory | undefined;
  private readonly clientName: string;
  private readonly clientVersion: string;

  constructor(options: ConnectionManagerOptions = {}) {
    this.oauthFactory = options.oauthFactory;
    this.clientName = options.clientName ?? "mcp-security-gateway";
    this.clientVersion = options.clientVersion ?? "0.1.0";
  }

  getServerRecord(serverId: string): McpServerRecord | undefined {
    return this.serverRecords.get(serverId);
  }

  getOAuthProvider(serverId: string): OAuthClientProvider | undefined {
    return this.oauthProviders.get(serverId);
  }

  async connect(server: McpServerRecord): Promise<DownstreamConnection> {
    if (this.connections.has(server.id)) {
      await this.disconnect(server.id);
    }

    this.serverRecords.set(server.id, server);

    const client = new Client(
      { name: this.clientName, version: this.clientVersion },
      { capabilities: {} }
    );

    let transport;
    if (server.transport === "stdio") {
      if (!server.command) {
        throw new Error(
          `Server "${server.name}" configured for stdio but missing command`
        );
      }
      transport = new StdioClientTransport({
        command: server.command,
        args: server.args ?? [],
        env: server.env
          ? ({ ...process.env, ...server.env } as Record<string, string>)
          : undefined,
      });
    } else {
      if (!server.url) {
        throw new Error(
          `Server "${server.name}" configured for HTTP but missing URL`
        );
      }

      if (server.authType === "oauth2" && this.oauthFactory) {
        let provider = this.oauthProviders.get(server.id);
        if (!provider) {
          const built = this.oauthFactory.forServer(server);
          if (built) {
            provider = built;
            this.oauthProviders.set(server.id, provider);
          }
        }
        transport = provider
          ? new StreamableHTTPClientTransport(new URL(server.url), {
              authProvider: provider,
            })
          : new StreamableHTTPClientTransport(new URL(server.url));
      } else {
        const headers: Record<string, string> = {};
        if (server.authHeaders && Object.keys(server.authHeaders).length > 0) {
          Object.assign(headers, server.authHeaders);
        }

        const httpOpts: Record<string, unknown> = {};
        if (Object.keys(headers).length > 0) {
          httpOpts.requestInit = { headers };
        }
        transport = new StreamableHTTPClientTransport(
          new URL(server.url),
          Object.keys(httpOpts).length > 0 ? httpOpts : undefined
        );
      }
    }

    await client.connect(transport);

    const toolsResult = await client.listTools();
    const tools = new Map<
      string,
      DownstreamConnection["tools"] extends Map<string, infer V> ? V : never
    >();
    for (const tool of toolsResult.tools) {
      tools.set(tool.name, {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
      });
    }

    const conn: DownstreamConnection = {
      client,
      serverId: server.id,
      serverName: server.name,
      tools,
    };

    this.connections.set(server.id, conn);
    console.log(
      `[gateway] Connected to "${server.name}" (${server.transport}), discovered ${tools.size} tools`
    );

    return conn;
  }

  updateServerRecord(server: McpServerRecord): void {
    this.serverRecords.set(server.id, server);
  }

  async reconnect(serverId: string): Promise<DownstreamConnection | null> {
    const server = this.serverRecords.get(serverId);
    if (!server) {
      console.warn(
        `[gateway] Cannot reconnect: no server record for ${serverId}`
      );
      return null;
    }
    console.log(
      `[gateway] Reconnecting to "${server.name}" with fresh credentials`
    );
    return this.connect(server);
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (conn) {
      try {
        await conn.client.close();
      } catch {
        // Ignore close errors
      }
      this.connections.delete(serverId);
      console.log(`[gateway] Disconnected from "${conn.serverName}"`);
    }
  }

  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connections.keys());
    await Promise.allSettled(ids.map((id) => this.disconnect(id)));
  }

  getConnection(serverId: string): DownstreamConnection | undefined {
    return this.connections.get(serverId);
  }

  getAllConnections(): DownstreamConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Resolve a namespaced tool name (`serverName__toolName`) to its connection
   * and the original (unnamespaced) tool name.
   */
  resolveNamespacedTool(
    namespacedName: string
  ): { connection: DownstreamConnection; toolName: string } | null {
    const separatorIndex = namespacedName.indexOf("__");
    if (separatorIndex === -1) return null;

    const serverName = namespacedName.substring(0, separatorIndex);
    const toolName = namespacedName.substring(separatorIndex + 2);

    for (const conn of this.connections.values()) {
      if (conn.serverName === serverName && conn.tools.has(toolName)) {
        return { connection: conn, toolName };
      }
    }

    return null;
  }
}
