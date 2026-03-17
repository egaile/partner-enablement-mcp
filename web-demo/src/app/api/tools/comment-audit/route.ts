import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ROVO_SERVER_NAME } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { CommentInfo, CommentAuditData } from '@/types/api';

const CLOUD_ID = '7c2ac73e-d0b6-4fa3-8059-3d5aa405c0e1';

const PageRefSchema = z.object({
  id: z.string().max(50),
  title: z.string().max(500),
});

const InputSchema = z.object({
  pageIds: z.array(PageRefSchema).max(50),
}).strict();

function rovo(toolName: string): string {
  return `${ROVO_SERVER_NAME}__${toolName}`;
}

function extractText(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}

/**
 * Parse a raw comment object from Confluence API into CommentInfo.
 */
function parseComment(
  raw: Record<string, unknown>,
  pageId: string,
  pageTitle: string,
  type: 'footer' | 'inline'
): CommentInfo {
  const body = (raw.body as Record<string, unknown>) ?? {};
  const bodyText = (body.storage as Record<string, unknown>)?.value ??
    (body.view as Record<string, unknown>)?.value ??
    (body.atlas_doc_format as Record<string, unknown>)?.value ??
    (raw.body as string) ?? '';

  return {
    id: String(raw.id ?? ''),
    pageId,
    pageTitle,
    author: ((raw.author as Record<string, unknown>)?.displayName as string) ??
      ((raw.author as Record<string, unknown>)?.publicName as string) ?? 'Unknown',
    body: typeof bodyText === 'string' ? bodyText.slice(0, 500) : JSON.stringify(bodyText).slice(0, 500),
    created: (raw.createdAt as string) ?? (raw.created as string) ?? '',
    type,
    resolved: type === 'inline' ? (raw.resolutionStatus === 'resolved') : undefined,
    replyCount: 0,
  };
}

async function fetchViaGateway(
  pageIds: Array<{ id: string; title: string }>
): Promise<CommentAuditData> {
  const footerComments: CommentInfo[] = [];
  const inlineComments: CommentInfo[] = [];
  const pagesWithComments = new Set<string>();

  for (const { id: pageId, title: pageTitle } of pageIds) {
    // Fetch footer comments
    try {
      const footerResult = await callTool(rovo('getConfluencePageFooterComments'), {
        cloudId: CLOUD_ID,
        pageId,
        limit: 25,
      });

      if (!footerResult.isError) {
        const footerText = extractText(footerResult);
        const footerData = JSON.parse(footerText);
        const rawComments = footerData?.results ?? footerData ?? [];

        for (const raw of Array.isArray(rawComments) ? rawComments : []) {
          const comment = parseComment(raw as Record<string, unknown>, pageId, pageTitle, 'footer');
          footerComments.push(comment);
          pagesWithComments.add(pageId);

          // Fetch replies for this footer comment
          try {
            const repliesResult = await callTool(rovo('getConfluenceCommentChildren'), {
              cloudId: CLOUD_ID,
              commentId: comment.id,
              commentType: 'footer',
              limit: 10,
            });

            if (!repliesResult.isError) {
              const repliesText = extractText(repliesResult);
              const repliesData = JSON.parse(repliesText);
              const rawReplies = repliesData?.results ?? repliesData ?? [];
              const replies: CommentInfo[] = [];

              for (const rawReply of Array.isArray(rawReplies) ? rawReplies : []) {
                replies.push(parseComment(rawReply as Record<string, unknown>, pageId, pageTitle, 'footer'));
              }

              comment.replyCount = replies.length;
              comment.replies = replies.length > 0 ? replies : undefined;
            }
          } catch {
            // Skip reply fetching silently
          }
        }
      }
    } catch (err) {
      console.warn(`[comment-audit] Failed to fetch footer comments for ${pageId}:`, err instanceof Error ? err.message : err);
    }

    // Fetch inline comments
    try {
      const inlineResult = await callTool(rovo('getConfluencePageInlineComments'), {
        cloudId: CLOUD_ID,
        pageId,
        limit: 25,
      });

      if (!inlineResult.isError) {
        const inlineText = extractText(inlineResult);
        const inlineData = JSON.parse(inlineText);
        const rawComments = inlineData?.results ?? inlineData ?? [];

        for (const raw of Array.isArray(rawComments) ? rawComments : []) {
          const comment = parseComment(raw as Record<string, unknown>, pageId, pageTitle, 'inline');
          inlineComments.push(comment);
          pagesWithComments.add(pageId);

          // Fetch replies for inline comments too
          try {
            const repliesResult = await callTool(rovo('getConfluenceCommentChildren'), {
              cloudId: CLOUD_ID,
              commentId: comment.id,
              commentType: 'inline',
              limit: 10,
            });

            if (!repliesResult.isError) {
              const repliesText = extractText(repliesResult);
              const repliesData = JSON.parse(repliesText);
              const rawReplies = repliesData?.results ?? repliesData ?? [];
              const replies: CommentInfo[] = [];

              for (const rawReply of Array.isArray(rawReplies) ? rawReplies : []) {
                replies.push(parseComment(rawReply as Record<string, unknown>, pageId, pageTitle, 'inline'));
              }

              comment.replyCount = replies.length;
              comment.replies = replies.length > 0 ? replies : undefined;
            }
          } catch {
            // Skip reply fetching silently
          }
        }
      }
    } catch (err) {
      console.warn(`[comment-audit] Failed to fetch inline comments for ${pageId}:`, err instanceof Error ? err.message : err);
    }
  }

  const totalComments = footerComments.length + inlineComments.length;
  const unresolvedInline = inlineComments.filter((c) => c.resolved === false).length;

  return {
    footerComments,
    inlineComments,
    totalComments,
    unresolvedInline,
    pagesWithComments: pagesWithComments.size,
    pagesWithoutComments: pageIds.length - pagesWithComments.size,
    source: 'gateway',
  };
}

function getMockData(
  pageIds: Array<{ id: string; title: string }>
): CommentAuditData {
  // Build a lookup for page titles
  const titleMap = new Map(pageIds.map((p) => [p.id, p.title]));
  const getTitle = (id: string) => titleMap.get(id) ?? 'Unknown Page';

  const footerComments: CommentInfo[] = [
    {
      id: 'fc-001',
      pageId: pageIds[0]?.id ?? 'page-001',
      pageTitle: getTitle(pageIds[0]?.id ?? 'page-001'),
      author: 'Sarah Chen',
      body: 'Updated the reference architecture to reflect the new FHIR R4 integration requirements. Please review the data flow diagrams.',
      created: '2026-03-09T10:15:00.000Z',
      type: 'footer',
      replyCount: 1,
      replies: [
        {
          id: 'fc-001-r1',
          pageId: pageIds[0]?.id ?? 'page-001',
          pageTitle: getTitle(pageIds[0]?.id ?? 'page-001'),
          author: 'Mike Johnson',
          body: 'Looks good. The FHIR Patient resource mapping needs one more field - mrn (Medical Record Number).',
          created: '2026-03-09T14:30:00.000Z',
          type: 'footer',
        },
      ],
    },
    {
      id: 'fc-002',
      pageId: pageIds[1]?.id ?? 'page-002',
      pageTitle: getTitle(pageIds[1]?.id ?? 'page-002'),
      author: 'David Park',
      body: 'Added new AI model evaluation criteria based on latest regulatory guidance from HHS.',
      created: '2026-03-07T16:00:00.000Z',
      type: 'footer',
      replyCount: 0,
    },
    {
      id: 'fc-003',
      pageId: pageIds[2]?.id ?? 'page-003',
      pageTitle: getTitle(pageIds[2]?.id ?? 'page-003'),
      author: 'Mike Johnson',
      body: 'The EHR integration specs need to be updated for the new Epic API version. Can someone from the integration team review?',
      created: '2026-02-25T11:45:00.000Z',
      type: 'footer',
      replyCount: 1,
      replies: [
        {
          id: 'fc-003-r1',
          pageId: pageIds[2]?.id ?? 'page-003',
          pageTitle: getTitle(pageIds[2]?.id ?? 'page-003'),
          author: 'Sarah Chen',
          body: 'I will update this next sprint. The new Epic February 2026 release has breaking changes in the Encounter resource.',
          created: '2026-02-26T09:00:00.000Z',
          type: 'footer',
        },
      ],
    },
    {
      id: 'fc-004',
      pageId: pageIds.length > 5 ? pageIds[5].id : 'page-006',
      pageTitle: getTitle(pageIds.length > 5 ? pageIds[5].id : 'page-006'),
      author: 'Sarah Chen',
      body: 'HIPAA compliance section 4.2 updated to include new AI-specific requirements from the 2026 HIPAA Security Rule update.',
      created: '2026-03-11T08:30:00.000Z',
      type: 'footer',
      replyCount: 0,
    },
  ];

  const inlineComments: CommentInfo[] = [
    {
      id: 'ic-001',
      pageId: pageIds.length > 5 ? pageIds[5].id : 'page-006',
      pageTitle: getTitle(pageIds.length > 5 ? pageIds[5].id : 'page-006'),
      author: 'David Park',
      body: 'This encryption requirement should specify AES-256-GCM, not just AES-256. GCM provides authenticated encryption which is required for PHI transport.',
      created: '2026-03-10T15:20:00.000Z',
      type: 'inline',
      resolved: false,
    },
    {
      id: 'ic-002',
      pageId: pageIds.length > 6 ? pageIds[6].id : 'page-007',
      pageTitle: getTitle(pageIds.length > 6 ? pageIds[6].id : 'page-007'),
      author: 'Mike Johnson',
      body: 'The PHI data classification tiers need a Tier 0 for fully de-identified data that can be used in AI training without restrictions.',
      created: '2026-02-08T13:00:00.000Z',
      type: 'inline',
      resolved: false,
    },
    {
      id: 'ic-003',
      pageId: pageIds.length > 5 ? pageIds[5].id : 'page-006',
      pageTitle: getTitle(pageIds.length > 5 ? pageIds[5].id : 'page-006'),
      author: 'Sarah Chen',
      body: 'Access control matrix reviewed and approved. RBAC roles are correctly mapped to HIPAA minimum necessary standard.',
      created: '2026-03-05T10:00:00.000Z',
      type: 'inline',
      resolved: true,
    },
  ];

  const pagesWithCommentIds = new Set<string>();
  for (const c of [...footerComments, ...inlineComments]) {
    pagesWithCommentIds.add(c.pageId);
  }

  const totalComments = footerComments.length + inlineComments.length;
  const unresolvedInline = inlineComments.filter((c) => c.resolved === false).length;

  return {
    footerComments,
    inlineComments,
    totalComments,
    unresolvedInline,
    pagesWithComments: pagesWithCommentIds.size,
    pagesWithoutComments: pageIds.length - pagesWithCommentIds.size,
    source: 'mock',
  };
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
    const { pageIds } = parsed.data;

    let data: CommentAuditData;

    if (isConfigured()) {
      try {
        data = await fetchViaGateway(pageIds);
      } catch (err) {
        console.warn(
          '[comment-audit] Gateway failed, using mock:',
          err instanceof Error ? err.message : err
        );
        resetSession();
        data = getMockData(pageIds);
      }
    } else {
      data = getMockData(pageIds);
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
