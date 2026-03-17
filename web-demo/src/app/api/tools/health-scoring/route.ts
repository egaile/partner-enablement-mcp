import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '../_rateLimit';
import type { PageInfo, CommentInfo, PageHealthScore, HealthScoringData } from '@/types/api';

/**
 * Health Scoring — pure computation, no gateway calls.
 *
 * Score formula (100 total):
 *   staleness:       0–30 (based on days since last modified)
 *   depth:           0–15 (based on hierarchy depth)
 *   commentActivity: 0–30 (based on comment counts)
 *   wordCount:       0–25 (based on word count)
 *
 * Status thresholds:
 *   healthy        >= 70
 *   needs-attention >= 50
 *   stale          >= 30
 *   critical       <  30
 */

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

/**
 * Compute staleness score (0-30).
 * 0-7 days:   30
 * 8-30 days:  20
 * 31-90 days: 10
 * 91+ days:   0
 */
function scoreStaleness(lastModified?: string): number {
  if (!lastModified) return 0;
  const now = Date.now();
  const modified = new Date(lastModified).getTime();
  if (isNaN(modified)) return 0;

  const daysSince = Math.floor((now - modified) / (1000 * 60 * 60 * 24));

  if (daysSince <= 7) return 30;
  if (daysSince <= 30) return 20;
  if (daysSince <= 90) return 10;
  return 0;
}

/**
 * Compute depth score (0-15).
 * depth 0 (root):  15
 * depth 1:         12
 * depth 2:         8
 * depth 3+:        4
 */
function scoreDepth(depth?: number): number {
  if (depth === undefined || depth === null) return 8;
  if (depth === 0) return 15;
  if (depth === 1) return 12;
  if (depth === 2) return 8;
  return 4;
}

/**
 * Compute comment activity score (0-30).
 * 3+ comments:  30
 * 2 comments:   22
 * 1 comment:    15
 * 0 comments:   5
 */
function scoreCommentActivity(commentCount: number): number {
  if (commentCount >= 3) return 30;
  if (commentCount === 2) return 22;
  if (commentCount === 1) return 15;
  return 5;
}

/**
 * Compute word count score (0-25).
 * 1000+ words: 25
 * 500-999:     20
 * 200-499:     15
 * 50-199:      8
 * <50:         3
 */
function scoreWordCount(wordCount: number): number {
  if (wordCount >= 1000) return 25;
  if (wordCount >= 500) return 20;
  if (wordCount >= 200) return 15;
  if (wordCount >= 50) return 8;
  return 3;
}

function getStatus(score: number): 'healthy' | 'needs-attention' | 'stale' | 'critical' {
  if (score >= 70) return 'healthy';
  if (score >= 50) return 'needs-attention';
  if (score >= 30) return 'stale';
  return 'critical';
}

function generateRecommendations(
  page: PageInfo,
  factors: PageHealthScore['factors'],
  details: { wordCount: number; lastModified?: string }
): string[] {
  const recommendations: string[] = [];

  // Staleness
  if (factors.staleness <= 10) {
    const daysSince = details.lastModified
      ? Math.floor((Date.now() - new Date(details.lastModified).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    if (daysSince !== null && daysSince > 30) {
      recommendations.push(`Page has not been updated in ${daysSince} days. Consider reviewing for accuracy.`);
    } else if (!details.lastModified) {
      recommendations.push('No modification date found. Verify page content is current.');
    }
  }

  // Depth
  if (factors.depth <= 4) {
    recommendations.push('Page is deeply nested. Consider restructuring for better discoverability.');
  }

  // Comment activity
  if (factors.commentActivity <= 5) {
    recommendations.push('No comments or discussion. Consider soliciting team review.');
  }

  // Word count
  if (details.wordCount < 50) {
    recommendations.push('Page has very little content. Consider expanding or removing if no longer needed.');
  } else if (details.wordCount < 200) {
    recommendations.push('Page is relatively short. Consider whether it should be merged with a parent page.');
  }

  // Has no children and is not deep — could be a stub
  if (!factors.hasChildren && (page.depth === 0 || page.depth === 1) && details.wordCount < 200) {
    recommendations.push('Root-level page with minimal content and no children. May be a stub page.');
  }

  return recommendations;
}

function computeScores(
  pages: PageInfo[],
  comments: { footerComments: CommentInfo[]; inlineComments: CommentInfo[] },
  pageDetails: Record<string, { wordCount: number; lastModified?: string }>,
  childrenOf: Map<string, Set<string>>
): HealthScoringData {
  // Index comments by pageId
  const commentCountByPage = new Map<string, number>();
  for (const c of [...comments.footerComments, ...comments.inlineComments]) {
    commentCountByPage.set(c.pageId, (commentCountByPage.get(c.pageId) ?? 0) + 1);
  }

  const pageScores: PageHealthScore[] = [];

  for (const page of pages) {
    const details = pageDetails[page.id] ?? { wordCount: page.wordCount ?? 0, lastModified: page.lastModified };
    const commentCount = commentCountByPage.get(page.id) ?? 0;
    const hasChildren = (childrenOf.get(page.id)?.size ?? 0) > 0;

    const staleness = scoreStaleness(details.lastModified);
    const depth = scoreDepth(page.depth);
    const commentActivity = scoreCommentActivity(commentCount);
    const wordCountScore = scoreWordCount(details.wordCount);

    const score = staleness + depth + commentActivity + wordCountScore;
    const status = getStatus(score);

    const factors = {
      staleness,
      depth,
      commentActivity,
      wordCount: wordCountScore,
      hasChildren,
    };

    const recommendations = generateRecommendations(page, factors, details);

    pageScores.push({
      pageId: page.id,
      title: page.title,
      score,
      factors,
      status,
      recommendations,
    });
  }

  // Sort by score ascending (worst first)
  pageScores.sort((a, b) => a.score - b.score);

  const averageScore = pageScores.length > 0
    ? Math.round(pageScores.reduce((sum, p) => sum + p.score, 0) / pageScores.length)
    : 0;

  return {
    pageScores,
    averageScore,
    healthyCount: pageScores.filter((p) => p.status === 'healthy').length,
    needsAttentionCount: pageScores.filter((p) => p.status === 'needs-attention').length,
    staleCount: pageScores.filter((p) => p.status === 'stale').length,
    criticalCount: pageScores.filter((p) => p.status === 'critical').length,
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
    const { pages, comments, pageDetails } = parsed.data;

    // Build children index for hasChildren checks
    const childrenOf = new Map<string, Set<string>>();
    for (const page of pages) {
      if (page.parentId) {
        const siblings = childrenOf.get(page.parentId) ?? new Set();
        siblings.add(page.id);
        childrenOf.set(page.parentId, siblings);
      }
    }

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
