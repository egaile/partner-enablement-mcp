import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callTool, isConfigured } from '@/lib/gateway-client';
import { ProjectKeySchema, rovo, extractText } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { SprintActionResult, SprintActionsData } from '@/types/api';

function detectPolicyBlock(errorText: string): {
  policyBlocked?: boolean;
  approvalRequired?: boolean;
  blockReason?: string;
} {
  const lower = errorText.toLowerCase();
  if (lower.includes('policy') && (lower.includes('blocked') || lower.includes('denied'))) {
    return { policyBlocked: true, blockReason: errorText };
  }
  if (lower.includes('approval') && lower.includes('required')) {
    return { approvalRequired: true, blockReason: errorText };
  }
  return { blockReason: errorText };
}

const SprintActionsInputSchema = z.object({
  projectKey: ProjectKeySchema,
  enabledActions: z.array(z.enum(['add_worklog', 'edit_issue', 'create_link', 'add_comment'])).max(10),
  issueKey: z.string().regex(/^[A-Z][A-Z0-9_]{0,9}-\d+$/).optional(),
  targetIssueKey: z.string().regex(/^[A-Z][A-Z0-9_]{0,9}-\d+$/).optional(),
  assigneeAccountId: z.string().max(200).optional(),
  linkType: z.string().max(100).optional(),
  worklogTime: z.string().max(20).optional(),
}).strict();

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = SprintActionsInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }
    const {
      projectKey,
      enabledActions,
      issueKey,
      targetIssueKey,
      assigneeAccountId,
      linkType,
      worklogTime,
    } = parsed.data;

    const actions: SprintActionResult[] = [];
    const key = issueKey ?? `${projectKey}-1`;

    if (!isConfigured()) {
      return NextResponse.json({
        actions: getMockActions(enabledActions, projectKey, key),
      } satisfies SprintActionsData);
    }

    // Get cloudId
    let cloudId: string;
    try {
      const resourcesResult = await callTool(rovo('getAccessibleAtlassianResources'), {});
      if (resourcesResult.isError) throw new Error(extractText(resourcesResult));
      const resources = JSON.parse(extractText(resourcesResult));
      cloudId = Array.isArray(resources) ? resources[0]?.id : resources?.id;
      if (!cloudId) throw new Error('No Atlassian cloud resources found');
    } catch (err) {
      console.warn('[sprint-actions] Cannot get cloudId, using mock:', err instanceof Error ? err.message : err);
      return NextResponse.json({
        actions: getMockActions(enabledActions, projectKey, key),
      } satisfies SprintActionsData);
    }

    // Execute each enabled action
    for (const action of enabledActions) {
      try {
        if (action === 'add_worklog') {
          const timeStr = worklogTime ?? '1h';
          const result = await callTool(rovo('addWorklogToJiraIssue'), {
            cloudId,
            issueIdOrKey: key,
            timeSpent: timeStr,
            commentBody: 'Sprint work logged via MCP Gateway demo',
          });

          if (result.isError) {
            const errText = extractText(result);
            actions.push({
              type: 'add_worklog',
              description: `Log ${timeStr} on ${key}`,
              toolUsed: 'addWorklogToJiraIssue',
              success: false,
              ...detectPolicyBlock(errText),
            });
          } else {
            actions.push({
              type: 'add_worklog',
              description: `Logged ${timeStr} of work on ${key}`,
              toolUsed: 'addWorklogToJiraIssue',
              success: true,
              details: { issueKey: key, timeSpent: timeStr },
            });
          }
        }

        if (action === 'edit_issue') {
          const fieldsToUpdate: Record<string, unknown> = {};

          if (assigneeAccountId) {
            fieldsToUpdate.assignee = { accountId: assigneeAccountId };
          } else {
            // Default: add a sprint-tracked label
            fieldsToUpdate.labels = { add: ['sprint-tracked'] };
          }

          const result = await callTool(rovo('editJiraIssue'), {
            cloudId,
            issueIdOrKey: key,
            fields: fieldsToUpdate,
          });

          if (result.isError) {
            const errText = extractText(result);
            actions.push({
              type: 'edit_issue',
              description: assigneeAccountId
                ? `Assign ${key} to team member`
                : `Add "sprint-tracked" label to ${key}`,
              toolUsed: 'editJiraIssue',
              success: false,
              ...detectPolicyBlock(errText),
            });
          } else {
            actions.push({
              type: 'edit_issue',
              description: assigneeAccountId
                ? `Assigned ${key} to team member`
                : `Added "sprint-tracked" label to ${key}`,
              toolUsed: 'editJiraIssue',
              success: true,
              details: { issueKey: key, fieldsUpdated: fieldsToUpdate },
            });
          }
        }

        if (action === 'create_link') {
          const target = targetIssueKey ?? `${projectKey}-2`;
          const type = linkType ?? 'Relates';

          try {
            const result = await callTool(rovo('jiraWrite'), {
              cloudId,
              action: 'createIssueLink',
              type,
              outwardIssue: key,
              inwardIssue: target,
            });

            if (result.isError) {
              const errText = extractText(result);
              actions.push({
                type: 'create_link',
                description: `Link ${key} → ${target} (${type})`,
                toolUsed: 'jiraWrite',
                success: false,
                ...detectPolicyBlock(errText),
              });
            } else {
              actions.push({
                type: 'create_link',
                description: `Linked ${key} ${type.toLowerCase()} ${target}`,
                toolUsed: 'jiraWrite',
                success: true,
                details: { outwardIssue: key, inwardIssue: target, linkType: type },
              });
            }
          } catch (err) {
            // jiraWrite may not be available via gateway — handle gracefully
            const errMsg = err instanceof Error ? err.message : 'Tool not available';
            actions.push({
              type: 'create_link',
              description: `Link ${key} → ${target} (${type})`,
              toolUsed: 'jiraWrite',
              success: false,
              ...detectPolicyBlock(errMsg),
            });
          }
        }

        if (action === 'add_comment') {
          const commentBody = `**Sprint Update**\n\nReviewed during sprint operations workflow. This issue is being actively tracked.\n\n_Posted via MCP Gateway Demo_`;

          const result = await callTool(rovo('addCommentToJiraIssue'), {
            cloudId,
            issueIdOrKey: key,
            commentBody,
          });

          if (result.isError) {
            const errText = extractText(result);
            actions.push({
              type: 'add_comment',
              description: `Add sprint update comment to ${key}`,
              toolUsed: 'addCommentToJiraIssue',
              success: false,
              ...detectPolicyBlock(errText),
            });
          } else {
            actions.push({
              type: 'add_comment',
              description: `Added sprint update comment to ${key}`,
              toolUsed: 'addCommentToJiraIssue',
              success: true,
              details: { issueKey: key },
            });
          }
        }
      } catch (err) {
        console.warn(`[sprint-actions] Action ${action} failed:`, err instanceof Error ? err.message : err);
        actions.push({
          type: action as SprintActionResult['type'],
          description: `Action failed: ${action}`,
          toolUsed: 'unknown',
          success: false,
          blockReason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({ actions } satisfies SprintActionsData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getMockActions(enabledActions: string[], projectKey: string, issueKey: string): SprintActionResult[] {
  const actions: SprintActionResult[] = [];

  if (enabledActions.includes('add_worklog')) {
    actions.push({
      type: 'add_worklog',
      description: `Logged 1h of work on ${issueKey}`,
      toolUsed: 'addWorklogToJiraIssue',
      success: true,
      details: { issueKey, timeSpent: '1h' },
    });
  }

  if (enabledActions.includes('edit_issue')) {
    actions.push({
      type: 'edit_issue',
      description: `Assigned ${issueKey} to team member`,
      toolUsed: 'editJiraIssue',
      success: true,
      details: { issueKey, fieldsUpdated: { assignee: { accountId: 'mock-002' } } },
    });
  }

  if (enabledActions.includes('create_link')) {
    actions.push({
      type: 'create_link',
      description: `Link ${issueKey} → ${projectKey}-2 (Relates)`,
      toolUsed: 'jiraWrite',
      success: false,
      policyBlocked: true,
      blockReason: 'Policy "Protected Projects" blocks jiraWrite for this tenant. Issue link creation requires admin approval.',
    });
  }

  if (enabledActions.includes('add_comment')) {
    actions.push({
      type: 'add_comment',
      description: `Add sprint update comment to ${issueKey}`,
      toolUsed: 'addCommentToJiraIssue',
      success: false,
      approvalRequired: true,
      blockReason: 'Policy "Approval for Writes" requires human-in-the-loop approval for addCommentToJiraIssue. Approval request submitted.',
    });
  }

  return actions;
}
