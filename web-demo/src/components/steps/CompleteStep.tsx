import { CheckCircle2, RotateCcw, Github, Linkedin, ExternalLink, ShieldCheck, Eye, BookOpen } from 'lucide-react';
import type { DemoData, WorkflowId } from '@/types/api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { getToolsForWorkflow, getAllUsedToolCount, ROVO_TOOLS } from '@/lib/rovo-tools';
import { getWorkflowConfig, WORKFLOWS } from '@/lib/constants';

interface CompleteStepProps {
  data: DemoData;
  workflowId: WorkflowId;
  onStartOver: () => void;
}

interface ToolUsageEntry {
  tool: string;
  step: string;
  count: number;
  type: 'read' | 'write';
}

function getToolUsageMatrix(data: CompleteStepProps['data'], workflowId: WorkflowId): ToolUsageEntry[] {
  const entries: ToolUsageEntry[] = [];

  if (workflowId === 'deployment-planning') {
    entries.push({ tool: 'getAccessibleAtlassianResources', step: 'Context', count: 1, type: 'read' });
    entries.push({ tool: 'getVisibleJiraProjects', step: 'Context', count: 1, type: 'read' });
    entries.push({ tool: 'searchJiraIssuesUsingJql', step: 'Context', count: 1, type: 'read' });
    entries.push({ tool: 'getJiraIssue', step: 'Context', count: 1, type: 'read' });
    entries.push({ tool: 'search (Rovo)', step: 'Search', count: 1, type: 'read' });
    entries.push({ tool: 'searchJiraIssuesUsingJql', step: 'Health', count: 4, type: 'read' });
    if (data.architecture?.confluenceContext && data.architecture.confluenceContext.length > 0) {
      entries.push({ tool: 'searchConfluenceUsingCql', step: 'Architecture', count: 1, type: 'read' });
      entries.push({ tool: 'getConfluencePage', step: 'Architecture', count: data.architecture.confluenceContext.length, type: 'read' });
    }
    if (data.compliance?.documentCoverage && data.compliance.documentCoverage.length > 0) {
      entries.push({ tool: 'searchConfluenceUsingCql', step: 'Compliance', count: data.compliance.documentCoverage.length, type: 'read' });
    }
    if (data.actions) {
      for (const action of data.actions.actions) {
        entries.push({ tool: action.toolUsed, step: 'Actions', count: 1, type: 'write' });
      }
    }
  } else if (workflowId === 'knowledge-audit') {
    entries.push({ tool: 'getAccessibleAtlassianResources', step: 'Space Discovery', count: 1, type: 'read' });
    entries.push({ tool: 'getConfluenceSpaces', step: 'Space Discovery', count: 1, type: 'read' });
    entries.push({ tool: 'getPagesInConfluenceSpace', step: 'Space Discovery', count: 1, type: 'read' });
    if (data['page-tree']) {
      entries.push({ tool: 'getConfluencePageDescendants', step: 'Page Tree', count: data['page-tree'].totalPages, type: 'read' });
      entries.push({ tool: 'getConfluencePage', step: 'Page Tree', count: data['page-tree'].totalPages, type: 'read' });
    }
    if (data['comment-audit']) {
      const pageCount = data['comment-audit'].pagesWithComments + data['comment-audit'].pagesWithoutComments;
      entries.push({ tool: 'getConfluencePageFooterComments', step: 'Comment Audit', count: pageCount, type: 'read' });
      entries.push({ tool: 'getConfluencePageInlineComments', step: 'Comment Audit', count: pageCount, type: 'read' });
      if (data['comment-audit'].footerComments.some((c) => c.replyCount && c.replyCount > 0)) {
        entries.push({ tool: 'getConfluenceCommentChildren', step: 'Comment Audit', count: 1, type: 'read' });
      }
    }
    if (data['knowledge-actions']) {
      for (const action of data['knowledge-actions'].actions) {
        entries.push({ tool: action.toolUsed, step: 'Agent Actions', count: 1, type: 'write' });
      }
    }
  } else if (workflowId === 'sprint-operations') {
    entries.push({ tool: 'getAccessibleAtlassianResources', step: 'Sprint Context', count: 1, type: 'read' });
    entries.push({ tool: 'getVisibleJiraProjects', step: 'Sprint Context', count: 1, type: 'read' });
    entries.push({ tool: 'getJiraProjectIssueTypesMetadata', step: 'Sprint Context', count: 1, type: 'read' });
    entries.push({ tool: 'getJiraIssueTypeMetaWithFields', step: 'Sprint Context', count: 1, type: 'read' });
    if (data['issue-deep-dive']) {
      entries.push({ tool: 'searchJiraIssuesUsingJql', step: 'Issue Deep Dive', count: 1, type: 'read' });
      entries.push({ tool: 'getJiraIssue', step: 'Issue Deep Dive', count: data['issue-deep-dive'].issues.length, type: 'read' });
      entries.push({ tool: 'getJiraIssueRemoteIssueLinks', step: 'Issue Deep Dive', count: data['issue-deep-dive'].issues.length, type: 'read' });
      entries.push({ tool: 'jiraRead (getIssueLinkTypes)', step: 'Issue Deep Dive', count: 1, type: 'read' });
    }
    if (data['team-lookup']) {
      entries.push({ tool: 'lookupJiraAccountId', step: 'Team Lookup', count: 1, type: 'read' });
    }
    if (data['sprint-actions']) {
      for (const action of data['sprint-actions'].actions) {
        entries.push({ tool: action.toolUsed, step: 'Sprint Actions', count: 1, type: 'write' });
      }
    }
  }

  return entries;
}

function getSummaryCards(data: DemoData, workflowId: WorkflowId) {
  if (workflowId === 'deployment-planning') {
    return [
      { title: 'Project Context', stat: data.context ? `${data.context.summary.totalIssues} issues analyzed` : 'Completed', tools: ['getVisibleJiraProjects', 'searchJiraIssuesUsingJql'] },
      { title: 'Cross-Product Search', stat: data.search ? `${data.search.results.length} results found` : 'Completed', tools: ['search (Rovo)'] },
      { title: 'Project Health', stat: data.health ? `Readiness: ${data.health.readinessScore}/100` : 'Completed', tools: ['searchJiraIssuesUsingJql x4'] },
      { title: 'Architecture', stat: data.architecture?.patternName || 'Pattern generated', tools: ['searchConfluenceUsingCql', 'getConfluencePage'] },
      { title: 'Compliance', stat: data.compliance ? `${data.compliance.applicableFrameworks.length} frameworks assessed` : 'Completed', tools: ['searchConfluenceUsingCql'] },
      { title: 'Implementation Plan', stat: data.plan ? `${data.plan.summary.totalWeeks}-week plan` : 'Completed', tools: ['knowledge_base'] },
      ...(data.actions ? [{ title: 'Agent Actions', stat: `${data.actions.actions.filter((a) => a.success).length}/${data.actions.actions.length} succeeded`, tools: Array.from(new Set(data.actions.actions.map((a) => a.toolUsed))) }] : []),
    ];
  } else if (workflowId === 'knowledge-audit') {
    return [
      { title: 'Space Discovery', stat: data['space-discovery'] ? `${data['space-discovery'].pages.length} pages found` : 'Completed', tools: ['getConfluenceSpaces', 'getPagesInConfluenceSpace'] },
      { title: 'Page Tree', stat: data['page-tree'] ? `${data['page-tree'].totalPages} pages, depth ${data['page-tree'].maxDepth}` : 'Completed', tools: ['getConfluencePageDescendants', 'getConfluencePage'] },
      { title: 'Comment Audit', stat: data['comment-audit'] ? `${data['comment-audit'].totalComments} comments found` : 'Completed', tools: ['getConfluencePageFooterComments', 'getConfluencePageInlineComments'] },
      { title: 'Health Scoring', stat: data['health-scoring'] ? `Avg: ${data['health-scoring'].averageScore}/100` : 'Completed', tools: ['local computation'] },
      ...(data['knowledge-actions'] ? [{ title: 'Agent Actions', stat: `${data['knowledge-actions'].actions.filter((a) => a.success).length}/${data['knowledge-actions'].actions.length} succeeded`, tools: Array.from(new Set(data['knowledge-actions'].actions.map((a) => a.toolUsed))) }] : []),
    ];
  } else {
    return [
      { title: 'Sprint Context', stat: data['sprint-context'] ? `${data['sprint-context'].selectedProject.issueTypes.length} issue types` : 'Completed', tools: ['getJiraProjectIssueTypesMetadata'] },
      { title: 'Issue Deep Dive', stat: data['issue-deep-dive'] ? `${data['issue-deep-dive'].totalInProgress} in progress` : 'Completed', tools: ['getJiraIssue', 'getJiraIssueRemoteIssueLinks'] },
      { title: 'Team Lookup', stat: data['team-lookup'] ? `${data['team-lookup'].members.length} members found` : 'Completed', tools: ['lookupJiraAccountId'] },
      ...(data['sprint-actions'] ? [{ title: 'Sprint Actions', stat: `${data['sprint-actions'].actions.filter((a) => a.success).length}/${data['sprint-actions'].actions.length} succeeded`, tools: Array.from(new Set(data['sprint-actions'].actions.map((a) => a.toolUsed))) }] : []),
    ];
  }
}

export function CompleteStep({ data, workflowId, onStartOver }: CompleteStepProps) {
  const toolUsage = getToolUsageMatrix(data, workflowId);
  const totalCalls = toolUsage.reduce((sum, e) => sum + e.count, 0);
  const uniqueTools = new Set(toolUsage.map((e) => e.tool)).size;
  const workflowConfig = getWorkflowConfig(workflowId);

  // Cross-workflow coverage
  const workflowTools = getToolsForWorkflow(workflowId);
  const allUsedCount = getAllUsedToolCount();
  const totalAvailable = ROVO_TOOLS.filter((t) => t.available).length;

  // Blocked ops across workflows
  const blockedOps = (data.actions?.actions.filter((a) => a.policyBlocked)?.length ?? 0)
    + (data['knowledge-actions']?.actions.filter((a) => a.policyBlocked)?.length ?? 0)
    + (data['sprint-actions']?.actions.filter((a) => a.policyBlocked)?.length ?? 0);

  const summaryCards = getSummaryCards(data, workflowId);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Success Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{workflowConfig.name} Complete</h2>
        <p className="text-gray-500 max-w-lg mx-auto text-sm">
          {uniqueTools} unique Rovo tools executed across {totalCalls} calls through the MCP Security Gateway,
          producing structured enterprise deliverables from live Atlassian data.
        </p>
      </div>

      {/* Tool Coverage Progress */}
      <Card className="!p-5">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-5 h-5 text-claude-orange" />
          <h3 className="font-semibold text-gray-900">Rovo Tool Coverage</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-claude-orange">{workflowTools.length}</p>
            <p className="text-xs text-gray-500">Tools in this workflow</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{allUsedCount}</p>
            <p className="text-xs text-gray-500">Tools across all workflows</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{totalAvailable}</p>
            <p className="text-xs text-gray-500">Available Rovo tools</p>
          </div>
        </div>
        {/* Coverage bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Cross-workflow coverage</span>
            <span>{allUsedCount}/{totalAvailable} ({Math.round(allUsedCount / totalAvailable * 100)}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-claude-orange to-amber-400 h-2 rounded-full transition-all"
              style={{ width: `${(allUsedCount / totalAvailable) * 100}%` }}
            />
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {WORKFLOWS.map((w) => {
              const count = getToolsForWorkflow(w.id).length;
              const isCurrent = w.id === workflowId;
              return (
                <span key={w.id} className={`text-xs px-2 py-0.5 rounded-full ${isCurrent ? 'bg-claude-orange/10 text-claude-orange font-medium' : 'bg-gray-100 text-gray-500'}`}>
                  {w.name}: {count} tools
                </span>
              );
            })}
          </div>
        </div>
      </Card>

      {/* What Was Demonstrated */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {summaryCards.map((card) => (
          <Card key={card.title} className="text-center !p-4">
            <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-2" />
            <h4 className="font-semibold text-gray-900 text-sm mb-1">{card.title}</h4>
            <p className="text-xs text-gray-500">{card.stat}</p>
            <div className="flex flex-wrap justify-center gap-1 mt-1.5">
              {card.tools.map((tool) => (
                <code key={tool} className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 py-0.5 rounded">
                  {tool}
                </code>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Security Summary */}
      <Card className="!p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Security Pipeline Summary</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{totalCalls}</p>
            <p className="text-xs text-gray-500">Total Tool Calls</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{totalCalls}</p>
            <p className="text-xs text-gray-500">Security Scans</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">0</p>
            <p className="text-xs text-gray-500">Threats Detected</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{blockedOps}</p>
            <p className="text-xs text-gray-500">Policy Blocks</p>
          </div>
        </div>
      </Card>

      {/* Rovo Tool Usage Matrix */}
      <Card className="!p-5">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-5 h-5 text-claude-orange" />
          <h3 className="font-semibold text-gray-900">Rovo Tool Usage</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-semibold text-gray-500">Tool</th>
                <th className="text-left py-2 font-semibold text-gray-500">Step</th>
                <th className="text-center py-2 font-semibold text-gray-500">Calls</th>
                <th className="text-center py-2 font-semibold text-gray-500">Type</th>
              </tr>
            </thead>
            <tbody>
              {toolUsage.map((entry, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 font-mono text-gray-700">{entry.tool}</td>
                  <td className="py-1.5 text-gray-600">{entry.step}</td>
                  <td className="py-1.5 text-center text-gray-700 font-medium">{entry.count}</td>
                  <td className="py-1.5 text-center">
                    <Badge variant={entry.type === 'read' ? 'green' : 'amber'} size="sm">
                      {entry.type}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* What This Proves */}
      <Card variant="highlighted" className="!p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-claude-orange" />
          <h3 className="font-semibold text-gray-900">What This Proves</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Structured, Auditable Access</p>
              <p className="text-xs text-gray-600 mt-0.5">
                MCP provides structured, auditable access to Atlassian data through standardized tool calls.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Least-Privilege Policies</p>
              <p className="text-xs text-gray-600 mt-0.5">
                The gateway enforces per-tool policies — read operations pass while writes require approval.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Full Audit Trail</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Every operation is logged with Atlassian-specific metadata — project keys, space keys, operation types.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Human-in-the-Loop</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Write operations can require human approval before execution, keeping humans in control.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button
          onClick={onStartOver}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          Try Another Workflow
        </button>
        <a
          href="https://github.com/egaile/partner-enablement-mcp"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
        >
          <Github className="w-4 h-4" />
          View Source on GitHub
        </a>
      </div>

      {/* About Section */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">About This Project</h3>
        <p className="text-sm text-gray-600 mb-5 leading-relaxed">
          This demonstration was built to show how Global System Integrators can
          operationalize Claude deployments faster. The MCP server architecture
          enables Claude to read project context from enterprise tools (like Jira and Confluence) and generate
          compliant, deployment-ready artifacts.
        </p>
        <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
          <div className="w-10 h-10 bg-gradient-to-br from-anthropic-700 to-anthropic-900 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            EG
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 text-sm">Ed Gaile</p>
            <p className="text-xs text-gray-500">Principal Solutions Architect</p>
          </div>
          <div className="flex gap-3">
            <a
              href="https://linkedin.com/in/edgaile"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <Linkedin className="w-3.5 h-3.5" />
              LinkedIn
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://github.com/egaile"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
