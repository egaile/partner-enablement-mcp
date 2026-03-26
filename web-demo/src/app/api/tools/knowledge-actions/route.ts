import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callTool, isConfigured } from '@/lib/gateway-client';
import { ATLASSIAN_CLOUD_ID, rovo, extractText } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { KnowledgeActionResult, KnowledgeActionsData } from '@/types/api';

const ActionSchema = z.object({
  type: z.enum(['footer_comment', 'inline_comment', 'update_page']),
  pageId: z.string().max(50),
  pageTitle: z.string().max(500).optional(),
  content: z.string().max(32767).optional(),
  textSelection: z.string().max(1000).optional(),
});

const InputSchema = z.object({
  spaceId: z.string().max(50),
  actions: z.array(ActionSchema).max(10),
}).strict();

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

async function executeViaGateway(
  spaceId: string,
  actions: Array<{
    type: 'footer_comment' | 'inline_comment' | 'update_page';
    pageId: string;
    pageTitle?: string;
    content?: string;
    textSelection?: string;
  }>
): Promise<KnowledgeActionsData> {
  const results: KnowledgeActionResult[] = [];

  for (const action of actions) {
    try {
      if (action.type === 'footer_comment') {
        const result = await callTool(rovo('createConfluenceFooterComment'), {
          cloudId: ATLASSIAN_CLOUD_ID,
          pageId: action.pageId,
          body: action.content,
        });

        if (result.isError) {
          const errText = extractText(result);
          results.push({
            type: 'footer_comment',
            description: `Add footer comment to "${action.pageTitle}"`,
            toolUsed: 'createConfluenceFooterComment',
            success: false,
            ...detectPolicyBlock(errText),
          });
        } else {
          results.push({
            type: 'footer_comment',
            description: `Added footer comment to "${action.pageTitle}"`,
            toolUsed: 'createConfluenceFooterComment',
            success: true,
            details: { pageId: action.pageId, pageTitle: action.pageTitle },
          });
        }
      }

      if (action.type === 'inline_comment') {
        const params: Record<string, unknown> = {
          cloudId: ATLASSIAN_CLOUD_ID,
          pageId: action.pageId,
          body: action.content,
        };

        if (action.textSelection) {
          params.inlineCommentProperties = {
            textSelection: action.textSelection,
            textSelectionMatchCount: 1,
            textSelectionMatchIndex: 0,
          };
        }

        const result = await callTool(rovo('createConfluenceInlineComment'), params);

        if (result.isError) {
          const errText = extractText(result);
          results.push({
            type: 'inline_comment',
            description: `Add inline comment to "${action.pageTitle}"`,
            toolUsed: 'createConfluenceInlineComment',
            success: false,
            ...detectPolicyBlock(errText),
          });
        } else {
          results.push({
            type: 'inline_comment',
            description: `Added inline comment to "${action.pageTitle}"`,
            toolUsed: 'createConfluenceInlineComment',
            success: true,
            details: {
              pageId: action.pageId,
              pageTitle: action.pageTitle,
              textSelection: action.textSelection,
            },
          });
        }
      }

      if (action.type === 'update_page') {
        const result = await callTool(rovo('updateConfluencePage'), {
          cloudId: ATLASSIAN_CLOUD_ID,
          pageId: action.pageId,
          spaceId,
          body: action.content,
          contentFormat: 'markdown',
          versionMessage: 'Automated update from Knowledge Base Audit',
        });

        if (result.isError) {
          const errText = extractText(result);
          results.push({
            type: 'update_page',
            description: `Update page "${action.pageTitle}"`,
            toolUsed: 'updateConfluencePage',
            success: false,
            ...detectPolicyBlock(errText),
          });
        } else {
          results.push({
            type: 'update_page',
            description: `Updated page "${action.pageTitle}"`,
            toolUsed: 'updateConfluencePage',
            success: true,
            details: { pageId: action.pageId, pageTitle: action.pageTitle },
          });
        }
      }
    } catch (err) {
      console.warn(
        `[knowledge-actions] Action ${action.type} failed for ${action.pageId}:`,
        err instanceof Error ? err.message : err
      );
      results.push({
        type: action.type,
        description: `${action.type.replace(/_/g, ' ')} on "${action.pageTitle}"`,
        toolUsed: action.type === 'footer_comment'
          ? 'createConfluenceFooterComment'
          : action.type === 'inline_comment'
            ? 'createConfluenceInlineComment'
            : 'updateConfluencePage',
        success: false,
        blockReason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return { actions: results };
}

function getMockData(
  actions: Array<{
    type: 'footer_comment' | 'inline_comment' | 'update_page';
    pageId: string;
    pageTitle?: string;
    content?: string;
    textSelection?: string;
  }>
): KnowledgeActionsData {
  const results: KnowledgeActionResult[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    if (i < 2) {
      // First two actions succeed
      const toolUsed = action.type === 'footer_comment'
        ? 'createConfluenceFooterComment'
        : action.type === 'inline_comment'
          ? 'createConfluenceInlineComment'
          : 'updateConfluencePage';

      const verb = action.type === 'footer_comment'
        ? 'Added footer comment to'
        : action.type === 'inline_comment'
          ? 'Added inline comment to'
          : 'Updated page';

      results.push({
        type: action.type,
        description: `${verb} "${action.pageTitle}"`,
        toolUsed,
        success: true,
        details: {
          pageId: action.pageId,
          pageTitle: action.pageTitle,
          ...(action.textSelection ? { textSelection: action.textSelection } : {}),
        },
      });
    } else {
      // Third+ actions are policy-blocked
      const toolUsed = action.type === 'footer_comment'
        ? 'createConfluenceFooterComment'
        : action.type === 'inline_comment'
          ? 'createConfluenceInlineComment'
          : 'updateConfluencePage';

      const verb = action.type === 'update_page'
        ? 'Update page'
        : action.type === 'footer_comment'
          ? 'Add footer comment to'
          : 'Add inline comment to';

      results.push({
        type: action.type,
        description: `${verb} "${action.pageTitle}"`,
        toolUsed,
        success: false,
        policyBlocked: true,
        blockReason:
          'Policy "Confluence View-Only" blocks write operations for this tenant. Content modification requires admin approval.',
      });
    }
  }

  return { actions: results };
}

export async function POST(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }
    const { spaceId, actions } = parsed.data;

    let data: KnowledgeActionsData;

    if (isConfigured()) {
      try {
        data = await executeViaGateway(spaceId, actions);
      } catch (err) {
        console.warn(
          '[knowledge-actions] Gateway failed, using mock:',
          err instanceof Error ? err.message : err
        );
        data = getMockData(actions);
      }
    } else {
      data = getMockData(actions);
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
