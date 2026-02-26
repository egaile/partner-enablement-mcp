# Connecting MCP Servers

The gateway acts as a transparent proxy between AI agents and one or more downstream MCP servers. It supports both HTTP and stdio transports.

## How connections work

When you register a server via the REST API, the gateway stores the configuration in Supabase. On the next engine initialization (or when a new tenant session starts), the gateway's `ConnectionManager` connects to each enabled server, runs `tools/list` to discover available tools, and stores the tool definitions in memory.

Tools are exposed to clients with a namespace prefix: `serverName__toolName`. For example, a tool named `search` on a server named `jira` becomes `jira__search`.

## Registering an HTTP server

HTTP-transport servers expose an MCP endpoint over HTTP using `StreamableHTTPServerTransport`.

```bash
curl -X POST http://localhost:4000/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "my-api-server",
    "transport": "http",
    "url": "https://my-mcp-server.example.com/mcp",
    "enabled": true
  }'
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique name within the tenant. Used as the namespace prefix. |
| `transport` | `"http"` | Yes | Transport type. |
| `url` | string | Yes (for HTTP) | Full URL of the MCP endpoint. |
| `enabled` | boolean | No | Defaults to `true`. Set `false` to disconnect without deleting. |

## Registering a stdio server

Stdio-transport servers are launched as child processes. The gateway spawns the process, communicates over stdin/stdout, and manages the process lifecycle.

```bash
curl -X POST http://localhost:4000/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "filesystem",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/documents"],
    "enabled": true
  }'
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique name within the tenant. |
| `transport` | `"stdio"` | Yes | Transport type. |
| `command` | string | Yes (for stdio) | The command to run (e.g., `node`, `npx`, `python`). |
| `args` | string[] | No | Command-line arguments. |
| `env` | object | No | Additional environment variables passed to the child process. Merged with the gateway's own environment. |
| `enabled` | boolean | No | Defaults to `true`. |

### Passing environment variables

If the downstream server needs API keys or configuration:

```bash
curl -X POST http://localhost:4000/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "github",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "ghp_xxxxxxxxxxxx"
    },
    "enabled": true
  }'
```

## Listing registered servers

```bash
curl http://localhost:4000/api/servers \
  -H "Authorization: Bearer <token>"
```

Response:

```json
{
  "servers": [
    {
      "id": "a1b2c3d4-...",
      "name": "my-api-server",
      "transport": "http",
      "url": "https://my-mcp-server.example.com/mcp",
      "enabled": true,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

## Testing connectivity

After registering a server, check that the gateway successfully connected by listing tools through the MCP proxy:

```bash
# Start a session
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "clientInfo": { "name": "test", "version": "1.0" },
      "capabilities": {}
    }
  }'
```

Then list tools using the session ID from the response:

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "mcp-session-id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

If the server connected successfully, you will see its tools prefixed with the server name.

## Checking server health

The gateway runs a health checker every 60 seconds that calls `tools/list` on each connected server.

```bash
curl http://localhost:4000/api/servers/<server-id>/health \
  -H "Authorization: Bearer <token>"
```

Response:

```json
{
  "serverId": "a1b2c3d4-...",
  "serverName": "my-api-server",
  "status": "healthy",
  "latencyMs": 42,
  "consecutiveFailures": 0,
  "lastChecked": "2025-01-15T10:05:00Z"
}
```

Health statuses:
- **healthy** -- responding within 5 seconds
- **degraded** -- responding but latency exceeds 5 seconds, or fewer than 3 consecutive failures
- **unreachable** -- 3 or more consecutive health check failures (triggers a `server_error` alert)

## Updating a server

```bash
curl -X PUT http://localhost:4000/api/servers/<server-id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "url": "https://new-url.example.com/mcp",
    "enabled": true
  }'
```

Note: changing a server's configuration requires the gateway engine to restart its connection to that server. The gateway does this automatically on the next session initialization.

## Disabling and deleting servers

Disable (keeps configuration, disconnects):

```bash
curl -X PUT http://localhost:4000/api/servers/<server-id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{ "enabled": false }'
```

Delete permanently:

```bash
curl -X DELETE http://localhost:4000/api/servers/<server-id> \
  -H "Authorization: Bearer <token>"
```

## Tool namespacing

All tools are namespaced as `serverName__toolName`. This prevents collisions when multiple servers expose tools with the same name. When an AI agent calls `jira__search_issues`, the gateway:

1. Parses the namespace: server = `jira`, tool = `search_issues`
2. Looks up the connection for server `jira`
3. Forwards the call as `search_issues` to the downstream server
4. Returns the response to the agent

## Connection failures

If the gateway fails to connect to a downstream server during engine initialization, it:

1. Logs the error to the console
2. Fires a `server_error` alert with type `connection_failure`
3. Continues connecting to other servers (failures are isolated)

The failed server's tools will not appear in `tools/list`. Fix the server configuration or ensure the server is running, then restart the gateway or wait for the next tenant session to retry.
