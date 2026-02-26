# Threat Model

The MCP Security Gateway is designed to protect organizations from threats that arise when AI agents interact with external tools via the Model Context Protocol. This document describes the threat landscape and how the gateway addresses each category.

## Threat landscape

AI agents that call tools through MCP introduce a unique set of risks:

1. **The agent is an untrusted intermediary.** The AI may be manipulated by adversarial prompts, hallucinate tool calls, or chain tools in unintended ways.
2. **Downstream servers are untrusted.** MCP servers may change their tool definitions (rug pulls), return malicious responses, or be compromised.
3. **Users operate with varying privilege levels.** Not every user should have access to every tool on every server.
4. **Sensitive data flows through tool calls.** PII, credentials, and business-critical data may appear in tool parameters or responses.

## Threat categories and mitigations

### T1: Prompt injection via tool parameters

**Threat:** An adversary crafts input that, when passed as a tool parameter, attempts to override the AI agent's instructions. This can cause the agent to execute unintended tools, leak data, or bypass safety controls.

**Mitigations:**
- **Pattern-match scanning** -- detects known injection phrases (e.g., "ignore previous instructions", DAN jailbreaks, ChatML delimiters)
- **Unicode analysis** -- detects zero-width characters, RTL overrides, and homoglyph attacks used to hide malicious content
- **Structural analysis** -- detects embedded `<system>`, `<tool_result>`, `<script>` tags, and JSON structures that mimic chat messages
- **Blocking** -- requests with critical or high severity threats are blocked before reaching the downstream server

### T2: Data exfiltration through tool parameters

**Threat:** An adversary embeds instructions in tool parameters that direct the AI to send data to external endpoints, encode and transmit sensitive information, or chain tools to leak data.

**Mitigations:**
- **Exfiltration scanning** -- detects URLs, known exfiltration domains (burpcollaborator, interact.sh), tool chaining instructions, and data transmission commands
- **PII detection** -- scans both request parameters and response content for SSN, credit cards, email, phone, IP addresses, dates of birth, and medical record numbers
- **PII redaction** -- when enabled by policy, replaces detected PII in responses with `[REDACTED]`

### T3: Tool definition drift (rug pulls)

**Threat:** A downstream MCP server changes its tool definitions after initial registration. New parameters could be used for injection, removed parameters could break expected behavior, and schema changes could alter the attack surface.

**Mitigations:**
- **SHA-256 snapshot hashing** -- every tool definition is hashed and stored on first use
- **Drift detection** -- on each tool call, the current definition is hashed and compared to the approved snapshot
- **Severity classification:**
  - `critical` -- new parameters added (blocks the call, potential injection surface)
  - `functional` -- parameters removed or schema added/removed (alerts but does not block)
  - `cosmetic` -- description changes only (alerts at lower severity)
- **Snapshot approval** -- administrators can review and approve new definitions through the dashboard

### T4: Unauthorized tool access

**Threat:** Users invoke tools they should not have access to, whether by role, time of day, or organizational policy.

**Mitigations:**
- **Policy engine** -- glob-pattern matching on server names and tool names
- **User restrictions** -- policies can target specific Clerk user IDs
- **Time windows** -- restrict tool access to specific days and hours
- **HITL approvals** -- high-risk operations can require explicit human approval before execution
- **Role-based access control** -- owner, admin, and member roles with different permission levels

### T5: Excessive tool usage

**Threat:** An AI agent enters a loop calling the same tool repeatedly, or a user floods a tool with requests, consuming resources or causing downstream service degradation.

**Mitigations:**
- **Per-user rate limiting** -- sliding 60-second window with configurable calls-per-minute limits
- **Rate limit alerts** -- automatic alerting when limits are exceeded

### T6: Downstream server compromise

**Threat:** A downstream MCP server is compromised and returns malicious content in tool responses, attempting to manipulate the AI agent.

**Mitigations:**
- **Response scanning** -- the same injection scanner runs on response content, detecting attempts to inject instructions into the AI via tool responses
- **Health monitoring** -- 60-second health checks detect servers that become unresponsive or unreliable
- **Connection isolation** -- failures in one downstream server do not affect others

### T7: Authentication and authorization bypass

**Threat:** Unauthenticated or unauthorized requests reach the gateway's API or MCP proxy.

**Mitigations:**
- **Clerk JWT verification** -- all API and MCP requests require a valid Clerk Bearer token or API key
- **Tenant isolation** -- Supabase RLS ensures data access is scoped to the user's tenants
- **API key authentication** -- programmatic access with SHA-256 hashed keys, expiration dates, and last-used tracking
- **Role guards** -- sensitive operations (key creation, team management) require elevated roles

### T8: Audit trail tampering

**Threat:** An attacker attempts to modify or delete audit logs to cover their tracks.

**Mitigations:**
- **Append-only audit log** -- the audit_logs table is designed for insert-only operations
- **Correlation IDs** -- every tool call is assigned a UUID that links the audit entry, alerts, and approval requests
- **Buffered writes with retry** -- failed writes are retried, not silently dropped
- **RLS protection** -- audit logs cannot be modified through the Supabase client (anon key)

## Security pipeline flow

Every tool call passes through this pipeline in order:

```
Request
  |
  v
1. Authentication (Clerk JWT or API key)
  |
  v
2. Policy evaluation (match rules by server, tool, user, time)
  |--- DENY ---> Block + alert + audit log
  |
  v
3. Rate limit check (if policy specifies maxCallsPerMinute)
  |--- EXCEEDED ---> Block + alert + audit log
  |
  v
4. Injection scan (4 strategies across all string params)
  |--- CRITICAL/HIGH ---> Block + alert + audit log
  |
  v
5. PII detection (request parameters)
  |
  v
6. Drift check (SHA-256 hash comparison)
  |--- CRITICAL ---> Block + alert + audit log
  |--- OTHER ------> Alert (non-blocking)
  |
  v
7. Forward to downstream server
  |
  v
8. Response scan (injection detection on response text)
  |
  v
9. PII detection + redaction (response content, if policy enables redactPII)
  |
  v
10. Audit log entry (buffered write to Supabase)
  |
  v
Response to agent
```

## Trust boundaries

```
+------------------+      +-----------------+      +--------------------+
|   AI Agent       | ---> | MCP Gateway     | ---> | Downstream MCP     |
|   (untrusted)    |      | (trust boundary)|      | Server (untrusted) |
+------------------+      +-----------------+      +--------------------+
                                  |
                                  v
                          +----------------+
                          |   Supabase     |
                          |   (trusted)    |
                          +----------------+
```

The gateway is the single trust boundary through which all tool interactions pass. Neither the AI agent nor the downstream servers are trusted.
