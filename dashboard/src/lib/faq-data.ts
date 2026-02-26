export interface FaqItem {
  question: string;
  answer: string;
}

export const faqData: FaqItem[] = [
  {
    question: "What is the MCP Security Gateway?",
    answer:
      "The MCP Security Gateway is a transparent proxy that sits between AI agents and downstream MCP servers. It intercepts every tool call to enforce security policies, scan for prompt injection attacks, detect tool definition drift, and produce a full audit trail — all without modifying the downstream servers themselves.",
  },
  {
    question: "Do I need Supabase and Clerk to run the gateway?",
    answer:
      "Yes, both are required for the full deployment. Supabase provides the Postgres database (with Row-Level Security) for storing tenants, policies, audit logs, alerts, and approval requests. Clerk handles authentication — either via JWT tokens from the dashboard or API keys for programmatic access. Both offer generous free tiers suitable for development and small deployments.",
  },
  {
    question: "What happens if no policy rules match a tool call?",
    answer:
      'The gateway uses a default-allow model. If no policy rules match a given tool call, it is allowed through. To enforce a default-deny posture, create a catch-all rule with the glob pattern `*` and action `deny` at the lowest priority. More specific allow rules at higher priorities will then override it.',
  },
  {
    question: "How does injection scanning work?",
    answer:
      "The gateway runs four scanning strategies on every tool call's string parameters: (1) Pattern matching detects known prompt injection phrases like 'ignore previous instructions'; (2) Unicode analysis flags suspicious characters used to bypass text filters; (3) Structural analysis identifies system prompt manipulation attempts; (4) Exfiltration detection catches attempts to send data to external URLs. If any strategy triggers, the call is blocked and an alert is created.",
  },
  {
    question: "What is tool drift detection?",
    answer:
      "Tool drift detection ensures that the tools exposed by a downstream MCP server haven't changed unexpectedly. When the gateway first discovers a server's tools, it computes a SHA-256 hash of each tool's schema (name, description, input schema). On subsequent connections, it compares the current hash against the stored snapshot. If they differ, an alert fires — this could indicate a compromised server or an unannounced breaking change.",
  },
  {
    question: "Can I use API keys instead of Clerk JWTs?",
    answer:
      "Yes. The gateway supports API key authentication as a fallback when no Bearer JWT is present. API keys are prefixed with `mgw_` and stored as SHA-256 hashes in the database. You can create and manage API keys from the Settings page in the dashboard. Each key is scoped to a tenant and optionally to specific roles.",
  },
  {
    question: "How do I connect a stdio-transport MCP server?",
    answer:
      "When adding a server in the dashboard, select 'stdio' as the transport type and provide the command to start the server (e.g., `node dist/index.js` or `python server.py`). The gateway will spawn the process and communicate with it over stdin/stdout using the MCP protocol. Make sure the server binary is accessible from the gateway's working directory or provide an absolute path.",
  },
  {
    question: "What is the HITL approval workflow?",
    answer:
      "Human-in-the-Loop (HITL) approval is a policy action that pauses a tool call and waits for a human to approve or reject it. When a policy rule's action is set to `require_approval`, the gateway creates an approval request, optionally fires a webhook notification, and holds the call until an admin responds via the dashboard's Approvals page or the API. This is ideal for high-risk operations like database modifications or production deployments.",
  },
  {
    question: "How is PII detected and redacted?",
    answer:
      "The gateway's PII scanner inspects all string values in tool call parameters and responses. It detects credit card numbers (with Luhn validation), Social Security numbers, email addresses, phone numbers, IP addresses, dates of birth, and medical record numbers using pattern matching. When PII is found in responses, it is redacted (replaced with `[REDACTED]`) before being forwarded to the AI agent. PII in requests triggers an alert.",
  },
  {
    question: "Can the gateway proxy to multiple downstream servers?",
    answer:
      "Yes. Each tenant can register multiple downstream MCP servers. The gateway aggregates tools from all connected servers and namespaces them as `serverName__toolName` to avoid collisions. When an agent calls a namespaced tool, the gateway routes the call to the correct downstream server. Each server can have its own transport type (stdio or HTTP) and independent policy rules.",
  },
];
