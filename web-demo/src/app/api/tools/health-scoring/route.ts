import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '../_rateLimit';
import type { PageInfo, CommentInfo } from '@/types/api';
import { buildChildrenIndex, computeScores } from '@/lib/health-scoring';

const PageInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  spaceId: z.string(),
  parentId: z.string().optional(),
  status: z.string(),
  lastModified: z.string().optional(),
  authorName: z.string().optional(),
  version: z.number().optional(),
  wordCount: z.number().optional(),
  depth: z.number().optional(),
});

const CommentInfoSchema = z.object({
  id: z.string(),
  pageId: z.string(),
  pageTitle: z.string(),
  author: z.string(),
  body: z.string(),
  created: z.string(),
  type: z.enum(['footer', 'inline']),
  resolved: z.boolean().optional(),
  replyCount: z.number().optional(),
  replies: z.array(z.unknown()).optional(),
});

const InputSchema = z.object({
  pages: z.array(PageInfoSchema).max(200),
  comments: z.object({
    footerComments: z.array(CommentInfoSchema),
    inlineComments: z.array(CommentInfoSchema),
  }),
  pageDetails: z.record(z.string(), z.object({
    wordCount: z.number(),
    lastModified: z.string().optional(),
  })),
}).strict();

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
    const { pages, comments, pageDetails } = parsed.data;

    const childrenOf = buildChildrenIndex(pages as PageInfo[]);
    const data = computeScores(
      pages as PageInfo[],
      comments as { footerComments: CommentInfo[]; inlineComments: CommentInfo[] },
      pageDetails,
      childrenOf
    );

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
