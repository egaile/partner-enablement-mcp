export interface RovoTool {
  name: string;
  category: 'Jira Read' | 'Jira Write' | 'Confluence Read' | 'Confluence Write' | 'Search' | 'Platform';
  risk: 'read' | 'write' | 'delete';
  description: string;
  usedInDemo: boolean;
}

export const ROVO_TOOLS: RovoTool[] = [
  // Platform
  { name: 'getAccessibleAtlassianResources', category: 'Platform', risk: 'read', description: 'Get available Atlassian cloud sites', usedInDemo: true },

  // Search
  { name: 'search', category: 'Search', risk: 'read', description: 'Rovo cross-product search across Jira and Confluence', usedInDemo: true },
  { name: 'searchJiraIssuesUsingJql', category: 'Search', risk: 'read', description: 'Search Jira issues using JQL queries', usedInDemo: true },
  { name: 'searchConfluenceUsingCql', category: 'Search', risk: 'read', description: 'Search Confluence content using CQL queries', usedInDemo: true },

  // Jira Read
  { name: 'getVisibleJiraProjects', category: 'Jira Read', risk: 'read', description: 'List visible Jira projects', usedInDemo: true },
  { name: 'getJiraIssue', category: 'Jira Read', risk: 'read', description: 'Get full details for a specific issue', usedInDemo: true },
  { name: 'getTransitionsForJiraIssue', category: 'Jira Read', risk: 'read', description: 'Get available workflow transitions', usedInDemo: true },
  { name: 'getJiraProjectIssueTypesMetadata', category: 'Jira Read', risk: 'read', description: 'Get issue types for a project', usedInDemo: false },
  { name: 'getJiraIssueTypeMetaWithFields', category: 'Jira Read', risk: 'read', description: 'Get field metadata for an issue type', usedInDemo: false },
  { name: 'getJiraIssueRemoteIssueLinks', category: 'Jira Read', risk: 'read', description: 'Get remote links on an issue', usedInDemo: false },
  { name: 'lookupJiraAccountId', category: 'Jira Read', risk: 'read', description: 'Look up user account IDs', usedInDemo: false },

  // Jira Write
  { name: 'createJiraIssue', category: 'Jira Write', risk: 'write', description: 'Create a new Jira issue', usedInDemo: true },
  { name: 'editJiraIssue', category: 'Jira Write', risk: 'write', description: 'Update issue fields (labels, assignee, etc.)', usedInDemo: true },
  { name: 'transitionJiraIssue', category: 'Jira Write', risk: 'write', description: 'Transition issue to a new status', usedInDemo: true },
  { name: 'addCommentToJiraIssue', category: 'Jira Write', risk: 'write', description: 'Add a comment to an issue', usedInDemo: true },
  { name: 'addWorklogToJiraIssue', category: 'Jira Write', risk: 'write', description: 'Log work time on an issue', usedInDemo: false },

  // Confluence Read
  { name: 'getConfluenceSpaces', category: 'Confluence Read', risk: 'read', description: 'List available Confluence spaces', usedInDemo: true },
  { name: 'getConfluencePage', category: 'Confluence Read', risk: 'read', description: 'Read a Confluence page by ID', usedInDemo: true },
  { name: 'getPagesInConfluenceSpace', category: 'Confluence Read', risk: 'read', description: 'List pages in a space', usedInDemo: false },
  { name: 'getConfluencePageDescendants', category: 'Confluence Read', risk: 'read', description: 'Get child pages of a page', usedInDemo: false },
  { name: 'getConfluencePageFooterComments', category: 'Confluence Read', risk: 'read', description: 'Get footer comments on a page', usedInDemo: false },
  { name: 'getConfluencePageInlineComments', category: 'Confluence Read', risk: 'read', description: 'Get inline comments on a page', usedInDemo: false },
  { name: 'getConfluenceCommentChildren', category: 'Confluence Read', risk: 'read', description: 'Get reply comments', usedInDemo: false },

  // Confluence Write
  { name: 'createConfluencePage', category: 'Confluence Write', risk: 'write', description: 'Create a new Confluence page', usedInDemo: true },
  { name: 'updateConfluencePage', category: 'Confluence Write', risk: 'write', description: 'Update an existing page', usedInDemo: false },
  { name: 'createConfluenceFooterComment', category: 'Confluence Write', risk: 'write', description: 'Add a footer comment to a page', usedInDemo: false },
  { name: 'createConfluenceInlineComment', category: 'Confluence Write', risk: 'write', description: 'Add an inline comment on text', usedInDemo: false },

  // Compass
  { name: 'getCompassComponents', category: 'Platform', risk: 'read', description: 'List Compass components', usedInDemo: false },
  { name: 'getCompassComponent', category: 'Platform', risk: 'read', description: 'Get Compass component details', usedInDemo: false },
  { name: 'createCompassComponent', category: 'Platform', risk: 'write', description: 'Create a Compass component', usedInDemo: false },
  { name: 'createCompassComponentRelationship', category: 'Platform', risk: 'write', description: 'Create component relationship', usedInDemo: false },

  // Jira links
  { name: 'jiraRead (getIssueLinkTypes)', category: 'Jira Read', risk: 'read', description: 'Get available issue link types', usedInDemo: false },
  { name: 'jiraWrite (createIssueLink)', category: 'Jira Write', risk: 'write', description: 'Create a link between issues', usedInDemo: false },
];

export const TOOL_CATEGORIES = [
  'Platform',
  'Search',
  'Jira Read',
  'Jira Write',
  'Confluence Read',
  'Confluence Write',
] as const;

export function getToolStats() {
  const total = ROVO_TOOLS.length;
  const usedInDemo = ROVO_TOOLS.filter((t) => t.usedInDemo).length;
  const readTools = ROVO_TOOLS.filter((t) => t.risk === 'read').length;
  const writeTools = ROVO_TOOLS.filter((t) => t.risk === 'write').length;
  return { total, usedInDemo, readTools, writeTools };
}
