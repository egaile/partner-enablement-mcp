import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServerRecord } from "../db/queries/servers.js";

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

  async connect(server: McpServerRecord): Promise<DownstreamConnection> {
    // Disconnect existing if present
    if (this.connections.has(server.id)) {
      await this.disconnect(server.id);
    }

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
      transport = new StreamableHTTPClientTransport(new URL(server.url));
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
