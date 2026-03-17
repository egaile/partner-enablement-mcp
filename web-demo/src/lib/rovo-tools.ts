import type { WorkflowId } from '@/types/api';

export interface RovoTool {
  name: string;
  category: 'Jira Read' | 'Jira Write' | 'Confluence Read' | 'Confluence Write' | 'Search' | 'Platform';
  risk: 'read' | 'write' | 'delete';
  description: string;
  usedInWorkflows: WorkflowId[];
  available: boolean;
}

export const ROVO_TOOLS: RovoTool[] = [
  // Platform
  { name: 'getAccessibleAtlassianResources', category: 'Platform', risk: 'read', description: 'Get available Atlassian cloud sites', usedInWorkflows: ['deployment-planning', 'knowledge-audit', 'sprint-operations'], available: true },

  // Search
  { name: 'search', category: 'Search', risk: 'read', description: 'Rovo cross-product search across Jira and Confluence', usedInWorkflows: ['deployment-planning'], available: true },
  { name: 'searchJiraIssuesUsingJql', category: 'Search', risk: 'read', description: 'Search Jira issues using JQL queries', usedInWorkflows: ['deployment-planning', 'sprint-operations'], available: true },
  { name: 'searchConfluenceUsingCql', category: 'Search', risk: 'read', description: 'Search Confluence content using CQL queries', usedInWorkflows: ['deployment-planning'], available: true },

  // Jira Read
  { name: 'getVisibleJiraProjects', category: 'Jira Read', risk: 'read', description: 'List visible Jira projects', usedInWorkflows: ['deployment-planning', 'sprint-operations'], available: true },
  { name: 'getJiraIssue', category: 'Jira Read', risk: 'read', description: 'Get full details for a specific issue', usedInWorkflows: ['deployment-planning', 'sprint-operations'], available: true },
  { name: 'getTransitionsForJiraIssue', category: 'Jira Read', risk: 'read', description: 'Get available workflow transitions', usedInWorkflows: ['deployment-planning'], available: true },
  { name: 'getJiraProjectIssueTypesMetadata', category: 'Jira Read', risk: 'read', description: 'Get issue types for a project', usedInWorkflows: ['sprint-operations'], available: true },
  { name: 'getJiraIssueTypeMetaWithFields', category: 'Jira Read', risk: 'read', description: 'Get field metadata for an issue type', usedInWorkflows: ['sprint-operations'], available: true },
  { name: 'getJiraIssueRemoteIssueLinks', category: 'Jira Read', risk: 'read', description: 'Get remote links on an issue', usedInWorkflows: ['sprint-operations'], available: true },
  { name: 'lookupJiraAccountId', category: 'Jira Read', risk: 'read', description: 'Look up user account IDs', usedInWorkflows: ['sprint-operations'], available: true },

  // Jira Write
  { name: 'createJiraIssue', category: 'Jira Write', risk: 'write', description: 'Create a new Jira issue', usedInWorkflows: ['deployment-planning'], available: true },
  { name: 'editJiraIssue', category: 'Jira Write', risk: 'write', description: 'Update issue fields (labels, assignee, etc.)', usedInWorkflows: ['deployment-planning', 'sprint-operations'], available: true },
  { name: 'transitionJiraIssue', category: 'Jira Write', risk: 'write', description: 'Transition issue to a new status', usedInWorkflows: ['deployment-planning'], available: true },
  { name: 'addCommentToJiraIssue', category: 'Jira Write', risk: 'write', description: 'Add a comment to an issue', usedInWorkflows: ['deployment-planning', 'sprint-operations'], available: true },
  { name: 'addWorklogToJiraIssue', category: 'Jira Write', risk: 'write', description: 'Log work time on an issue', usedInWorkflows: ['sprint-operations'], available: true },

  // Confluence Read
  { name: 'getConfluenceSpaces', category: 'Confluence Read', risk: 'read', description: 'List available Confluence spaces', usedInWorkflows: ['deployment-planning', 'knowledge-audit'], available: true },
  { name: 'getConfluencePage', category: 'Confluence Read', risk: 'read', description: 'Read a Confluence page by ID', usedInWorkflows: ['deployment-planning', 'knowledge-audit'], available: true },
  { name: 'getPagesInConfluenceSpace', category: 'Confluence Read', risk: 'read', description: 'List pages in a space', usedInWorkflows: ['knowledge-audit'], available: true },
  { name: 'getConfluencePageDescendants', category: 'Confluence Read', risk: 'read', description: 'Get child pages of a page', usedInWorkflows: ['knowledge-audit'], available: true },
  { name: 'getConfluencePageFooterComments', category: 'Confluence Read', risk: 'read', description: 'Get footer comments on a page', usedInWorkflows: ['knowledge-audit'], available: true },
  { name: 'getConfluencePageInlineComments', category: 'Confluence Read', risk: 'read', description: 'Get inline comments on a page', usedInWorkflows: ['knowledge-audit'], available: true },
  { name: 'getConfluenceCommentChildren', category: 'Confluence Read', risk: 'read', description: 'Get reply comments', usedInWorkflows: ['knowledge-audit'], available: true },

  // Confluence Write
  { name: 'createConfluencePage', category: 'Confluence Write', risk: 'write', description: 'Create a new Confluence page', usedInWorkflows: ['deployment-planning'], available: true },
  { name: 'updateConfluencePage', category: 'Confluence Write', risk: 'write', description: 'Update an existing page', usedInWorkflows: ['knowledge-audit'], available: true },
  { name: 'createConfluenceFooterComment', category: 'Confluence Write', risk: 'write', description: 'Add a footer comment to a page', usedInWorkflows: ['knowledge-audit'], available: true },
  { name: 'createConfluenceInlineComment', category: 'Confluence Write', risk: 'write', description: 'Add an inline comment on text', usedInWorkflows: ['knowledge-audit'], available: true },

  // Compass (unavailable)
  { name: 'getCompassComponents', category: 'Platform', risk: 'read', description: 'List Compass components', usedInWorkflows: [], available: false },
  { name: 'getCompassComponent', category: 'Platform', risk: 'read', description: 'Get Compass component details', usedInWorkflows: [], available: false },
  { name: 'createCompassComponent', category: 'Platform', risk: 'write', description: 'Create a Compass component', usedInWorkflows: [], available: false },
  { name: 'createCompassComponentRelationship', category: 'Platform', risk: 'write', description: 'Create component relationship', usedInWorkflows: [], available: false },

  // Jira links
  { name: 'jiraRead (getIssueLinkTypes)', category: 'Jira Read', risk: 'read', description: 'Get available issue link types', usedInWorkflows: ['sprint-operations'], available: true },
  { name: 'jiraWrite (createIssueLink)', category: 'Jira Write', risk: 'write', description: 'Create a link between issues', usedInWorkflows: ['sprint-operations'], available: true },
];

export const TOOL_CATEGORIES = [
  'Platform',
  'Search',
  'Jira Read',
  'Jira Write',
  'Confluence Read',
  'Confluence Write',
] as const;

export function getToolStats(workflow?: WorkflowId) {
  const total = ROVO_TOOLS.filter((t) => t.available).length;
  const usedInDemo = workflow
    ? ROVO_TOOLS.filter((t) => t.usedInWorkflows.includes(workflow)).length
    : ROVO_TOOLS.filter((t) => t.usedInWorkflows.length > 0).length;
  const readTools = ROVO_TOOLS.filter((t) => t.risk === 'read' && t.available).length;
  const writeTools = ROVO_TOOLS.filter((t) => t.risk === 'write' && t.available).length;
  const unavailable = ROVO_TOOLS.filter((t) => !t.available).length;
  return { total, usedInDemo, readTools, writeTools, unavailable, totalIncludingUnavailable: ROVO_TOOLS.length };
}

export function getToolsForWorkflow(workflow: WorkflowId): RovoTool[] {
  return ROVO_TOOLS.filter((t) => t.usedInWorkflows.includes(workflow));
}

export function getAllUsedToolCount(): number {
  return ROVO_TOOLS.filter((t) => t.usedInWorkflows.length > 0).length;
}
