import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServerRecord } from "../db/queries/servers.js";
import { ServerOAuthProvider } from "../auth/server-oauth-provider.js";

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

export class ConnectionManager {
  private connections = new Map<string, DownstreamConnection>();
  private serverRecords = new Map<string, McpServerRecord>();
  /** OAuth providers keyed by serverId — reused across reconnects */
  private oauthProviders = new Map<string, ServerOAuthProvider>();

  getServerRecord(serverId: string): McpServerRecord | undefined {
    return this.serverRecords.get(serverId);
  }

  getOAuthProvider(serverId: string): ServerOAuthProvider | undefined {
    return this.oauthProviders.get(serverId);
  }

  async connect(server: McpServerRecord): Promise<DownstreamConnection> {
    // Disconnect existing if present
    if (this.connections.has(server.id)) {
      await this.disconnect(server.id);
    }

    // Store server record for reconnection
    this.serverRecords.set(server.id, server);

    const client = new Client(
      { name: "mcp-security-gateway", version: "0.1.0" },
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
          ? { ...process.env, ...server.env } as Record<string, string>
          : undefined,
      });
    } else {
      if (!server.url) {
        throw new Error(
          `Server "${server.name}" configured for HTTP but missing URL`
        );
      }

      if (server.authType === "oauth2") {
        // Use MCP SDK's built-in OAuth 2.1 with PKCE
        let provider = this.oauthProviders.get(server.id);
        if (!provider) {
          provider = new ServerOAuthProvider(server);
          this.oauthProviders.set(server.id, provider);
        } else {
          provider.updateServerRecord(server);
        }
        transport = new StreamableHTTPClientTransport(
          new URL(server.url),
          { authProvider: provider }
        );
      } else {
        // Static auth headers
        let headers: Record<string, string> = {};
        if (server.authHeaders && Object.keys(server.authHeaders).length > 0) {
          headers = { ...server.authHeaders };
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

    // Discover tools
    const toolsResult = await client.listTools();
    const tools = new Map<string, DownstreamConnection["tools"] extends Map<string, infer V> ? V : never>();
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

  /**
   * Update the cached server record (e.g., after OAuth token exchange).
   */
  updateServerRecord(server: McpServerRecord): void {
    this.serverRecords.set(server.id, server);
  }

  /**
   * Reconnect to a downstream server with fresh credentials.
   * Used after an OAuth token refresh.
   */
  async reconnect(serverId: string): Promise<DownstreamConnection | null> {
    const server = this.serverRecords.get(serverId);
    if (!server) {
      console.warn(`[gateway] Cannot reconnect: no server record for ${serverId}`);
      return null;
    }
    console.log(`[gateway] Reconnecting to "${server.name}" with fresh credentials`);
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
   * Resolve a namespaced tool name (serverId__toolName) to its connection and original name.
   */
  resolveNamespacedTool(
    namespacedName: string
  ): { connection: DownstreamConnection; toolName: string } | null {
    const separatorIndex = namespacedName.indexOf("__");
    if (separatorIndex === -1) return null;

    const serverName = namespacedName.substring(0, separatorIndex);
    const toolName = namespacedName.substring(separatorIndex + 2);

    // Find by server name
    for (const conn of this.connections.values()) {
      if (conn.serverName === serverName && conn.tools.has(toolName)) {
        return { connection: conn, toolName };
      }
    }

    return null;
  }
}
