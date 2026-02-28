# Connecting to Atlassian Rovo MCP Server

This guide walks you through connecting the Atlassian Rovo MCP Server to the MCP Security Gateway. Once connected, all AI agent interactions with Jira, Confluence, and Compass flow through the gateway's security pipeline -- injection scanning, policy enforcement, PII detection, and audit logging.

## Architecture

```
AI Client (Claude, Cursor, Copilot)
    |
    v
MCP Security Gateway          <-- your gateway URL
    |  injection scan
    |  policy enforcement
    |  PII detection
    |  audit logging
    v
Atlassian Rovo MCP Server     <-- https://mcp.atlassian.com/v1/mcp
    |
    v
Jira Cloud / Confluence Cloud
```

The AI client connects to the gateway. The gateway proxies requests to Atlassian's Rovo MCP Server, applying security checks on every tool call. The client never talks to Atlassian directly.

## Prerequisites

- An Atlassian Cloud site (Jira and/or Confluence)
- Rovo MCP Server enabled by your Atlassian admin (Administration > Apps > AI settings > Rovo MCP server)
- API token auth enabled by your admin (if using API tokens instead of OAuth)
- A running MCP Security Gateway instance with an API key or Clerk session

## Step 1: Generate an Atlassian API Token

1. Go to [Atlassian API Token Management](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Give it a label (e.g., "MCP Gateway")
4. Copy the token -- you won't be able to see it again

## Step 2: Encode Your Credentials

The Rovo MCP Server uses HTTP Basic Auth. Encode your email and API token:

```bash
echo -n "your.email@company.com:YOUR_API_TOKEN" | base64
```

This outputs a Base64 string like `eW91ci5lbWFpbEBjb21wYW55LmNvbTpZT1VSX0FQSV9UT0tFTg==`.

## Step 3: Register Rovo in the Gateway

### Option A: Via the Dashboard

1. Go to **Servers > Add Server** in the dashboard
2. Set the server name to `atlassian-rovo` (or any name you prefer)
3. Set transport to **HTTP**
4. Set the URL to `https://mcp.atlassian.com/v1/mcp`
5. The form auto-detects Rovo and suggests Basic Auth
6. Enter your Atlassian email and API token
7. Click **Add Server**

### Option B: Via the API

```bash
# Replace the values below
GATEWAY_URL="https://your-gateway.example.com"
GATEWAY_TOKEN="your-gateway-api-key"
ATLASSIAN_EMAIL="your.email@company.com"
ATLASSIAN_API_TOKEN="YOUR_API_TOKEN"

# Base64-encode the credentials
AUTH_ENCODED=$(echo -n "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" | base64)

curl -X POST "$GATEWAY_URL/api/servers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GATEWAY_TOKEN" \
  -d "{
    \"name\": \"atlassian-rovo\",
    \"transport\": \"http\",
    \"url\": \"https://mcp.atlassian.com/v1/mcp\",
    \"authHeaders\": {
      \"Authorization\": \"Basic $AUTH_ENCODED\"
    },
    \"enabled\": true
  }"
```

## Step 4: Verify the Connection

Check that the gateway connected and discovered tools:

```bash
curl "$GATEWAY_URL/api/servers" \
  -H "Authorization: Bearer $GATEWAY_TOKEN"
```

You should see the `atlassian-rovo` server with `enabled: true`. The gateway logs will show:

```
[gateway] Connected to "atlassian-rovo" (http), discovered 40 tools
```

You can also check health:

```bash
curl "$GATEWAY_URL/api/servers/<server-id>/health" \
  -H "Authorization: Bearer $GATEWAY_TOKEN"
```

## Step 5: Point Your AI Client at the Gateway

Now configure your AI client to use the gateway instead of connecting to Atlassian directly.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "secure-atlassian": {
      "url": "https://your-gateway.example.com/mcp",
      "headers": {
        "Authorization": "Bearer your-gateway-api-key"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add secure-atlassian \
  --transport http \
  --url https://your-gateway.example.com/mcp \
  --header "Authorization: Bearer your-gateway-api-key"
```

### Cursor

In Cursor's MCP settings:

```json
{
  "secure-atlassian": {
    "url": "https://your-gateway.example.com/mcp",
    "headers": {
      "Authorization": "Bearer your-gateway-api-key"
    }
  }
}
```

### VS Code

In `.vscode/mcp.json`:

```json
{
  "servers": {
    "secure-atlassian": {
      "url": "https://your-gateway.example.com/mcp",
      "type": "http",
      "headers": {
        "Authorization": "Bearer your-gateway-api-key"
      }
    }
  }
}
```

## Available Tools

Once connected, the gateway exposes all Rovo tools with the `atlassian-rovo__` namespace prefix. The Rovo MCP Server provides 40+ tools across Jira, Confluence, and Compass:

### Jira Tools
| Gateway Tool Name | Description |
|-------------------|-------------|
| `atlassian-rovo__getJiraIssue` | Get issue details by key (e.g., PROJ-123) |
| `atlassian-rovo__createJiraIssue` | Create a new issue |
| `atlassian-rovo__editJiraIssue` | Update issue fields |
| `atlassian-rovo__searchJiraIssuesUsingJql` | Search with JQL |
| `atlassian-rovo__addCommentToJiraIssue` | Add a comment |
| `atlassian-rovo__transitionJiraIssue` | Change issue status |
| `atlassian-rovo__getVisibleJiraProjects` | List accessible projects |
| `atlassian-rovo__lookupJiraAccountId` | Find user by name/email |

### Confluence Tools
| Gateway Tool Name | Description |
|-------------------|-------------|
| `atlassian-rovo__getConfluencePage` | Read page content (Markdown) |
| `atlassian-rovo__createConfluencePage` | Create a new page |
| `atlassian-rovo__updateConfluencePage` | Edit a page |
| `atlassian-rovo__searchConfluenceUsingCql` | Search with CQL |
| `atlassian-rovo__getConfluenceSpaces` | List spaces |

### Platform Tools
| Gateway Tool Name | Description |
|-------------------|-------------|
| `atlassian-rovo__search` | Natural language search across all products |
| `atlassian-rovo__atlassianUserInfo` | Current user info |
| `atlassian-rovo__getAccessibleAtlassianResources` | List cloud IDs |

> **Note:** All tools require a `cloudId` parameter. Call `atlassian-rovo__getAccessibleAtlassianResources` first to get your site's cloud ID.

## Step 6: Apply Security Policies

Now that Atlassian traffic flows through the gateway, apply security policies. Use the pre-built Atlassian templates:

### Via the Dashboard

Go to **Onboarding** or use the **Policy Templates** section to apply:

- **Read-Only Jira** -- Block all write operations (create, edit, transition)
- **Protected Projects** -- Block access to sensitive Jira projects (HR, Security)
- **Approval for Writes** -- Require human approval before any create/update
- **Confluence View-Only** -- Allow reads, block edits
- **Audit Everything** -- Log all calls without blocking (good starting point)
- **PII Shield** -- Scan Jira content for PII before returning to agents

### Via the API

```bash
# List available templates
curl "$GATEWAY_URL/api/templates/atlassian" \
  -H "Authorization: Bearer $GATEWAY_TOKEN"

# Apply a template
curl -X POST "$GATEWAY_URL/api/templates/atlassian/read-only-jira/apply" \
  -H "Authorization: Bearer $GATEWAY_TOKEN"
```

## Audit Logging

Every tool call through the gateway is logged with Atlassian-specific metadata:

- **Jira project key** extracted from issue keys (e.g., `PROJ` from `PROJ-123`)
- **Confluence space key** from page operations
- **Operation type** (read/write) mapped from the tool name
- **Policy decision** (allowed, blocked, required approval)
- **Threat detection** results (injection scan, PII detection)

View logs in the dashboard under **Audit Log**, or query the API:

```bash
curl "$GATEWAY_URL/api/audit?limit=20" \
  -H "Authorization: Bearer $GATEWAY_TOKEN"
```

## Security Features

The gateway's security pipeline applies to every Atlassian tool call:

1. **Prompt Injection Scanning** -- 20 Atlassian-specific patterns detect malicious instructions embedded in Jira issues and Confluence pages (e.g., "ignore previous instructions" in issue descriptions)
2. **Policy Enforcement** -- Block or require approval for specific operations, projects, or users
3. **PII Detection** -- Scan tool call parameters and responses for credit card numbers, SSNs, emails, phone numbers
4. **Tool Drift Detection** -- SHA-256 hash comparison alerts you if Atlassian changes tool definitions
5. **Rate Limiting** -- Prevent runaway agents from flooding your Atlassian instance

## Troubleshooting

### "Server configured for HTTP but missing URL"
The server record doesn't have a URL. Update it:
```bash
curl -X PUT "$GATEWAY_URL/api/servers/<id>" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GATEWAY_TOKEN" \
  -d '{"url": "https://mcp.atlassian.com/v1/mcp"}'
```

### Connection fails with 401
Your Atlassian credentials are incorrect or expired. Verify:
1. The email matches your Atlassian account
2. The API token hasn't been revoked
3. API token auth is enabled by your Atlassian admin
4. The Base64 encoding is correct (no trailing newline)

Test your credentials directly:
```bash
curl -X POST https://mcp.atlassian.com/v1/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'email:token' | base64)" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","clientInfo":{"name":"test","version":"1.0"},"capabilities":{}}}'
```

### "0 tools discovered"
- Check that your Atlassian user has access to at least one Jira project or Confluence space
- Some tools (Compass) are only available via OAuth, not API tokens
- The Rovo MCP Server must be enabled by your Atlassian site admin

### Tools show up but calls fail
- Most tools require a `cloudId` parameter. Call `getAccessibleAtlassianResources` first
- Ensure your user has the right Jira/Confluence permissions for the operation
- Check the gateway audit log for policy blocks or injection detections

## Alternative: OAuth Authentication

Instead of API tokens, you can use OAuth 2.1 Bearer tokens. This is useful if you have an OAuth flow that issues tokens for your Atlassian site:

```bash
curl -X POST "$GATEWAY_URL/api/servers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GATEWAY_TOKEN" \
  -d '{
    "name": "atlassian-rovo",
    "transport": "http",
    "url": "https://mcp.atlassian.com/v1/mcp",
    "authHeaders": {
      "Authorization": "Bearer <oauth-access-token>"
    },
    "enabled": true
  }'
```

Note that OAuth tokens expire. You'll need to update the server's `authHeaders` when the token refreshes:

```bash
curl -X PUT "$GATEWAY_URL/api/servers/<server-id>" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GATEWAY_TOKEN" \
  -d '{
    "authHeaders": {
      "Authorization": "Bearer <new-oauth-token>"
    }
  }'
```

API tokens (Basic Auth) are recommended for production use as they don't expire unless revoked.
