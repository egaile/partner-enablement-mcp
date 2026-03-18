import type { PolicyTemplate, PolicyDecision, PolicyRule } from '@/types/api';

/**
 * Simple glob matcher for policy tool/server patterns.
 * Supports only `*` wildcard (matches any characters).
 * E.g., "*create_issue*" matches "atlassian__createJiraIssue"
 */
function globMatch(pattern: string, value: string): boolean {
  // Convert glob pattern to regex
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
  return regex.test(value);
}

function matchesConditions(
  rule: PolicyRule,
  toolName: string,
  _serverName?: string,
): boolean {
  // Check tool conditions
  if (rule.conditions.tools && rule.conditions.tools.length > 0) {
    const toolMatch = rule.conditions.tools.some((pattern) =>
      globMatch(pattern, toolName)
    );
    if (!toolMatch) return false;
  }

  // Check server conditions
  if (rule.conditions.servers && rule.conditions.servers.length > 0) {
    const serverMatch = rule.conditions.servers.some((pattern) =>
      globMatch(pattern, _serverName ?? toolName)
    );
    if (!serverMatch) return false;
  }

  return true;
}

/**
 * Evaluate a set of active policy templates against a tool call.
 * Returns the decision from the highest-priority matching rule.
 */
export function evaluatePolicy(
  templates: PolicyTemplate[],
  toolName: string,
  serverName?: string,
): { decision: PolicyDecision; matchedRule?: string; matchedTemplate?: string } {
  // Collect all rules from active templates, sorted by priority (lower = higher priority)
  const allRules: Array<{ rule: PolicyRule; templateName: string }> = [];
  for (const template of templates) {
    for (const rule of template.rules) {
      allRules.push({ rule, templateName: template.name });
    }
  }
  allRules.sort((a, b) => a.rule.priority - b.rule.priority);

  // Evaluate in priority order — first match wins
  for (const { rule, templateName } of allRules) {
    if (matchesConditions(rule, toolName, serverName)) {
      return {
        decision: rule.action,
        matchedRule: rule.name,
        matchedTemplate: templateName,
      };
    }
  }

  // Default: allow if no rules match
  return { decision: 'allow' };
}

/**
 * Pre-defined tool calls for the governance simulator.
 */
export const SIMULATED_TOOL_CALLS = [
  {
    toolName: 'searchJiraIssuesUsingJql',
    displayName: 'Search Jira Issues',
    type: 'read' as const,
    exampleParams: { jql: 'project = HEALTH AND status = "In Progress"', maxResults: 50 },
  },
  {
    toolName: 'createJiraIssue',
    displayName: 'Create Jira Issue',
    type: 'write' as const,
    exampleParams: { projectKey: 'HEALTH', summary: 'Implement HIPAA audit trail', issueType: 'Story' },
  },
  {
    toolName: 'getConfluencePage',
    displayName: 'Read Confluence Page',
    type: 'read' as const,
    exampleParams: { pageId: '123456', bodyFormat: 'storage' },
  },
  {
    toolName: 'updateConfluencePage',
    displayName: 'Update Confluence Page',
    type: 'write' as const,
    exampleParams: { pageId: '123456', title: 'Architecture Review', content: 'Updated deployment guide...' },
  },
  {
    toolName: 'addCommentToJiraIssue',
    displayName: 'Add Comment to Issue',
    type: 'write' as const,
    exampleParams: { issueKey: 'HEALTH-42', body: 'Sprint review notes: PHI handling approved' },
  },
  {
    toolName: 'editJiraIssue',
    displayName: 'Edit Jira Issue',
    type: 'write' as const,
    exampleParams: { issueKey: 'HEALTH-42', fields: { assignee: 'user123', priority: 'High' } },
  },
];

/**
 * Sample PII-laden text for redaction demo.
 */
export const PII_DEMO_TEXT = `Patient Intake Record - CONFIDENTIAL

Patient: John Smith
SSN: 123-45-6789
Date of Birth: 03/15/1982
Medical Record: MRN: 00789456

Insurance Information:
  Credit Card on File: 4111111111111111
  Billing Email: john.smith@hospital.com
  Phone: (555) 867-5309

Primary Care Provider: Dr. Sarah Johnson
  Contact: sarah.johnson@healthnet.com
  Office IP: 192.168.1.100

Notes: Patient presents with symptoms consistent with...`;
