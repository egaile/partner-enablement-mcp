/**
 * Pre-built Atlassian policy templates for one-click setup during onboarding.
 * Each template maps to a PolicyRuleInput that can be created via the policies API.
 */

export interface AtlassianPolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: "access" | "security" | "compliance";
  rules: Array<{
    name: string;
    description: string;
    priority: number;
    conditions: {
      servers?: string[];
      tools?: string[];
      users?: string[];
    };
    action: "allow" | "deny" | "require_approval" | "log_only";
    modifiers?: {
      redactPII?: boolean;
      maxCallsPerMinute?: number;
    };
  }>;
}

/**
 * Atlassian Rovo MCP Server tool naming conventions:
 * - Read: jira_search, jira_get_issue, confluence_search, confluence_get_page
 * - Write: jira_create_issue, jira_update_issue, jira_transition_issue,
 *          confluence_create_page, confluence_update_page
 * - Delete: jira_delete_issue, confluence_delete_page
 */

export const ATLASSIAN_POLICY_TEMPLATES: AtlassianPolicyTemplate[] = [
  {
    id: "read_only_jira",
    name: "Read-Only Jira",
    description:
      "Agents can search and view Jira issues but cannot create, update, or transition them.",
    category: "access",
    rules: [
      {
        name: "Block Jira writes",
        description: "Deny all Jira write operations",
        priority: 100,
        conditions: {
          tools: [
            "*create_issue*",
            "*update_issue*",
            "*transition_issue*",
            "*delete_issue*",
            "*add_comment*",
            "*edit_comment*",
            "*assign_issue*",
          ],
        },
        action: "deny",
      },
      {
        name: "Allow Jira reads",
        description: "Allow all Jira read operations",
        priority: 200,
        conditions: {
          tools: [
            "*search*",
            "*get_issue*",
            "*get_project*",
            "*list_*",
          ],
        },
        action: "allow",
      },
    ],
  },
  {
    id: "protected_projects",
    name: "Protected Projects",
    description:
      "Block all agent access to specific Jira projects (e.g., HR, Security, Finance). Configure project keys after applying.",
    category: "access",
    rules: [
      {
        name: "Block protected project access",
        description:
          "Deny all tool calls to servers matching protected project patterns. Update the server pattern to match your protected project server names.",
        priority: 50,
        conditions: {
          servers: ["*HR*", "*SEC*", "*FIN*"],
        },
        action: "deny",
      },
    ],
  },
  {
    id: "approval_for_writes",
    name: "Approval for Writes",
    description:
      "Any create, update, or transition operation requires human approval before execution.",
    category: "access",
    rules: [
      {
        name: "Require approval for Jira writes",
        description: "HITL approval for all Jira modification operations",
        priority: 100,
        conditions: {
          tools: [
            "*create_issue*",
            "*update_issue*",
            "*transition_issue*",
            "*delete_issue*",
            "*add_comment*",
            "*assign_issue*",
          ],
        },
        action: "require_approval",
      },
      {
        name: "Require approval for Confluence writes",
        description: "HITL approval for all Confluence modification operations",
        priority: 100,
        conditions: {
          tools: [
            "*create_page*",
            "*update_page*",
            "*delete_page*",
          ],
        },
        action: "require_approval",
      },
    ],
  },
  {
    id: "confluence_view_only",
    name: "Confluence View-Only",
    description:
      "Agents can search and read Confluence pages but cannot create or edit them.",
    category: "access",
    rules: [
      {
        name: "Block Confluence writes",
        description: "Deny all Confluence write operations",
        priority: 100,
        conditions: {
          tools: [
            "*create_page*",
            "*update_page*",
            "*delete_page*",
            "*create_space*",
          ],
        },
        action: "deny",
      },
      {
        name: "Allow Confluence reads",
        description: "Allow all Confluence read operations",
        priority: 200,
        conditions: {
          tools: [
            "*search*",
            "*get_page*",
            "*get_space*",
            "*list_*",
          ],
        },
        action: "allow",
      },
    ],
  },
  {
    id: "audit_everything",
    name: "Audit Everything",
    description:
      "Maximum visibility mode — log all calls with no blocking. Ideal as a compliance starter to understand agent behavior before adding restrictions.",
    category: "compliance",
    rules: [
      {
        name: "Log all tool calls",
        description: "Log every tool call for audit trail",
        priority: 1000,
        conditions: {
          tools: ["*"],
        },
        action: "log_only",
      },
    ],
  },
  {
    id: "pii_shield",
    name: "PII Shield",
    description:
      "Scan all Jira and Confluence content for PII (SSN, credit cards, emails, phone numbers) before returning to the agent, and redact any matches.",
    category: "security",
    rules: [
      {
        name: "PII scanning and redaction",
        description:
          "Scan and redact PII from all tool responses",
        priority: 100,
        conditions: {
          tools: ["*"],
        },
        action: "allow",
        modifiers: {
          redactPII: true,
        },
      },
    ],
  },
];

/**
 * Get a template by its ID.
 */
export function getAtlassianTemplate(
  id: string
): AtlassianPolicyTemplate | undefined {
  return ATLASSIAN_POLICY_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get all templates, optionally filtered by category.
 */
export function getAtlassianTemplates(
  category?: AtlassianPolicyTemplate["category"]
): AtlassianPolicyTemplate[] {
  if (!category) return ATLASSIAN_POLICY_TEMPLATES;
  return ATLASSIAN_POLICY_TEMPLATES.filter((t) => t.category === category);
}
