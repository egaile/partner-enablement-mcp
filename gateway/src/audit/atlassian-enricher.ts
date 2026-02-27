/**
 * Atlassian-aware audit log enrichment.
 * Extracts Jira project keys, Confluence space keys, and operation types
 * from tool call parameters to enhance audit log entries.
 */

export interface AtlassianMetadata {
  /** Jira project key (e.g., "PROJ") extracted from issue keys or params */
  projectKey?: string;
  /** Jira issue key (e.g., "PROJ-123") */
  issueKey?: string;
  /** Confluence space key */
  spaceKey?: string;
  /** Confluence page ID */
  pageId?: string;
  /** Mapped Atlassian operation type */
  operationType?: AtlassianOperationType;
  /** Whether the operation modifies data */
  isWriteOperation: boolean;
}

export type AtlassianOperationType =
  | "search_issues"
  | "get_issue"
  | "create_issue"
  | "update_issue"
  | "transition_issue"
  | "delete_issue"
  | "add_comment"
  | "assign_issue"
  | "search_pages"
  | "get_page"
  | "create_page"
  | "update_page"
  | "delete_page"
  | "unknown";

// Jira issue key pattern: PROJECT-123
const ISSUE_KEY_REGEX = /\b([A-Z][A-Z0-9_]+-\d+)\b/;
// Standalone project key from params
const PROJECT_KEY_REGEX = /^[A-Z][A-Z0-9_]+$/;

const WRITE_TOOL_PATTERNS = [
  "create", "update", "delete", "transition", "assign",
  "add_comment", "edit_comment", "move",
];

const OPERATION_MAP: Record<string, AtlassianOperationType> = {
  // Jira
  search: "search_issues",
  search_issues: "search_issues",
  jira_search: "search_issues",
  get_issue: "get_issue",
  jira_get_issue: "get_issue",
  create_issue: "create_issue",
  jira_create_issue: "create_issue",
  update_issue: "update_issue",
  jira_update_issue: "update_issue",
  transition_issue: "transition_issue",
  jira_transition_issue: "transition_issue",
  delete_issue: "delete_issue",
  jira_delete_issue: "delete_issue",
  add_comment: "add_comment",
  jira_add_comment: "add_comment",
  assign_issue: "assign_issue",
  jira_assign_issue: "assign_issue",
  // Confluence
  search_pages: "search_pages",
  confluence_search: "search_pages",
  get_page: "get_page",
  confluence_get_page: "get_page",
  create_page: "create_page",
  confluence_create_page: "create_page",
  update_page: "update_page",
  confluence_update_page: "update_page",
  delete_page: "delete_page",
  confluence_delete_page: "delete_page",
};

/**
 * Extract Atlassian metadata from tool call parameters.
 * Parses project keys from issue keys, space keys from page operations,
 * and maps tool names to Atlassian operation types.
 */
export function enrichAtlassianMetadata(
  toolName: string,
  params: Record<string, unknown>
): AtlassianMetadata {
  const metadata: AtlassianMetadata = {
    isWriteOperation: false,
  };

  // Strip server namespace prefix (e.g., "rovo__jira_create_issue" → "jira_create_issue")
  const baseTool = toolName.includes("__")
    ? toolName.split("__").pop()!
    : toolName;

  // Map operation type
  metadata.operationType = OPERATION_MAP[baseTool] ?? "unknown";

  // Determine if write operation
  metadata.isWriteOperation = WRITE_TOOL_PATTERNS.some((p) =>
    baseTool.includes(p)
  );

  // Extract issue key from params
  const issueKey = extractIssueKey(params);
  if (issueKey) {
    metadata.issueKey = issueKey;
    metadata.projectKey = issueKey.split("-")[0];
  }

  // Extract project key from params directly
  if (!metadata.projectKey) {
    metadata.projectKey = extractProjectKey(params);
  }

  // Extract Confluence space key
  metadata.spaceKey = extractSpaceKey(params);

  // Extract page ID
  metadata.pageId = extractPageId(params);

  return metadata;
}

function extractIssueKey(
  params: Record<string, unknown>
): string | undefined {
  // Check common param names for issue key
  for (const key of ["issueKey", "issue_key", "issueId", "issue_id", "key", "issue"]) {
    const val = params[key];
    if (typeof val === "string") {
      const match = val.match(ISSUE_KEY_REGEX);
      if (match) return match[1];
    }
  }

  // Check JQL for issue keys
  if (typeof params.jql === "string") {
    const match = params.jql.match(ISSUE_KEY_REGEX);
    if (match) return match[1];
  }

  // Deep search string values
  for (const val of Object.values(params)) {
    if (typeof val === "string") {
      const match = val.match(ISSUE_KEY_REGEX);
      if (match) return match[1];
    }
  }

  return undefined;
}

function extractProjectKey(
  params: Record<string, unknown>
): string | undefined {
  for (const key of ["projectKey", "project_key", "project"]) {
    const val = params[key];
    if (typeof val === "string" && PROJECT_KEY_REGEX.test(val)) {
      return val;
    }
  }

  // Extract from JQL "project = KEY"
  if (typeof params.jql === "string") {
    const match = params.jql.match(/project\s*=\s*["']?([A-Z][A-Z0-9_]+)["']?/i);
    if (match) return match[1].toUpperCase();
  }

  return undefined;
}

function extractSpaceKey(
  params: Record<string, unknown>
): string | undefined {
  for (const key of ["spaceKey", "space_key", "space"]) {
    const val = params[key];
    if (typeof val === "string" && val.length > 0) {
      return val;
    }
  }
  return undefined;
}

function extractPageId(
  params: Record<string, unknown>
): string | undefined {
  for (const key of ["pageId", "page_id", "page"]) {
    const val = params[key];
    if (typeof val === "string" && val.length > 0) {
      return val;
    }
  }
  return undefined;
}
