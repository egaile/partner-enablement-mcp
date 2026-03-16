/**
 * Lightweight MCP JSON-RPC client for calling the gateway's /mcp endpoint.
 * Uses raw fetch — no MCP SDK dependency needed.
 *
 * Rec 3: Converted from module-scoped mutable state to a factory pattern.
 * Each createGatewaySession() returns an isolated session with its own
 * sessionId and requestId counter, preventing concurrent requests from
 * different users from sharing/overwriting MCP sessions.
 */

const GATEWAY_URL = process.env.GATEWAY_URL;
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY;

function isConfigured(): boolean {
  return !!(GATEWAY_URL && GATEWAY_API_KEY);
}

export interface GatewaySession {
  callTool: (name: string, args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }>;
  listTools: () => Promise<Array<{ name: string; description?: string }>>;
  resetSession: () => void;
}

export function createGatewaySession(): GatewaySession {
  let sessionId: string | null = null;
  let requestId = 0;

  function nextId(): number {
    return ++requestId;
  }

  async function jsonRpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!GATEWAY_URL || !GATEWAY_API_KEY) {
      throw new Error("Gateway not configured (GATEWAY_URL / GATEWAY_API_KEY missing)");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${GATEWAY_API_KEY}`,
    };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }

    const body: Record<string, unknown> = {
      jsonrpc: "2.0",
      method,
      params: params ?? {},
    };

    // MCP notifications (method starts with "notifications/") must NOT have an id
    const isNotification = method.startsWith("notifications/");
    if (!isNotification) {
      body.id = nextId();
    }

    const res = await fetch(`${GATEWAY_URL}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    // Capture session ID from response headers
    const sid = res.headers.get("mcp-session-id");
    if (sid) {
      sessionId = sid;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gateway HTTP ${res.status}: ${text}`);
    }

    // Notifications return 202 Accepted with no body
    if (isNotification) {
      return undefined;
    }

    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Gateway returned non-JSON (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }
    if (json.error) {
      const err = json.error as { code?: number; message?: string };
      throw new Error(`MCP error ${err.code}: ${err.message}`);
    }

    return json.result;
  }

  async function initSession(): Promise<void> {
    if (sessionId) return;

    await jsonRpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "web-demo", version: "1.0.0" },
    });

    await jsonRpc("notifications/initialized");
  }

  async function callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }> {
    await initSession();
    const result = await jsonRpc("tools/call", { name, arguments: args });
    return result as { content: Array<{ type: string; text?: string }>; isError?: boolean };
  }

  async function listTools(): Promise<Array<{ name: string; description?: string }>> {
    await initSession();
    const result = await jsonRpc("tools/list") as { tools: Array<{ name: string; description?: string }> };
    return result.tools;
  }

  function resetSession(): void {
    sessionId = null;
  }

  return { callTool, listTools, resetSession };
}

// Backward-compatible default session for single-user contexts (e.g. web-demo)
const defaultSession = createGatewaySession();

export const callTool = defaultSession.callTool;
export const listTools = defaultSession.listTools;
export const resetSession = defaultSession.resetSession;

export { isConfigured };
