/**
 * Lightweight MCP JSON-RPC client for calling the gateway's /mcp endpoint.
 * Uses raw fetch — no MCP SDK dependency needed.
 */

const GATEWAY_URL = process.env.GATEWAY_URL;
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY;

let sessionId: string | null = null;
let requestId = 0;

function nextId(): number {
  return ++requestId;
}

function isConfigured(): boolean {
  return !!(GATEWAY_URL && GATEWAY_API_KEY);
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

  const body = {
    jsonrpc: "2.0",
    id: nextId(),
    method,
    params: params ?? {},
  };

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

  const json = await res.json();
  if (json.error) {
    throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
  }

  return json.result;
}

/**
 * Initialize an MCP session with the gateway.
 * Must be called before callTool/listTools.
 */
async function initSession(): Promise<void> {
  if (sessionId) return; // already initialized

  await jsonRpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "web-demo", version: "1.0.0" },
  });

  // Send initialized notification (no response expected, but gateway may require it)
  // We send it as a request with a fresh ID — the gateway will accept it
  await jsonRpc("notifications/initialized");
}

/**
 * Call an MCP tool through the gateway.
 * Auto-initializes the session if needed.
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }> {
  await initSession();
  const result = await jsonRpc("tools/call", { name, arguments: args });
  return result as { content: Array<{ type: string; text?: string }>; isError?: boolean };
}

/**
 * List available tools from the gateway.
 * Auto-initializes the session if needed.
 */
export async function listTools(): Promise<Array<{ name: string; description?: string }>> {
  await initSession();
  const result = await jsonRpc("tools/list") as { tools: Array<{ name: string; description?: string }> };
  return result.tools;
}

/**
 * Reset the cached session (forces re-initialization on next call).
 */
export function resetSession(): void {
  sessionId = null;
}

export { isConfigured };
