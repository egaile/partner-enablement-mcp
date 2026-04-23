import type { PageInfo, CommentInfo, PageHealthScore, HealthScoringData } from '@/types/api';

/**
 * Knowledge-health scoring — pure, deterministic. Shared between the
 * in-workflow POST route and the Dashboard Hub REST endpoint.
 *
 * Score formula (100 total):
 *   staleness:       0–30 (days since last modified)
 *   depth:           0–15 (hierarchy position)
 *   commentActivity: 0–30 (footer + inline comment counts)
 *   wordCount:       0–25 (content volume)
 *
 * Status thresholds:
 *   healthy         >= 70
 *   needs-attention >= 50
 *   stale           >= 30
 *   critical        <  30
 */

export function scoreStaleness(lastModified?: string): number {
  if (!lastModified) return 0;
  const modified = new Date(lastModified).getTime();
  if (isNaN(modified)) return 0;
  const daysSince = Math.floor((Date.now() - modified) / (1000 * 60 * 60 * 24));
  if (daysSince <= 7) return 30;
  if (daysSince <= 30) return 20;
  if (daysSince <= 90) return 10;
  return 0;
}

export function scoreDepth(depth?: number): number {
  if (depth === undefined || depth === null) return 8;
  if (depth === 0) return 15;
  if (depth === 1) return 12;
  if (depth === 2) return 8;
  return 4;
}

export function scoreCommentActivity(commentCount: number): number {
  if (commentCount >= 3) return 30;
  if (commentCount === 2) return 22;
  if (commentCount === 1) return 15;
  return 5;
}

export function scoreWordCount(wordCount: number): number {
  if (wordCount >= 1000) return 25;
  if (wordCount >= 500) return 20;
  if (wordCount >= 200) return 15;
  if (wordCount >= 50) return 8;
  return 3;
}

export function getStatus(score: number): PageHealthScore['status'] {
  if (score >= 70) return 'healthy';
  if (score >= 50) return 'needs-attention';
  if (score >= 30) return 'stale';
  return 'critical';
}

export function generateRecommendations(
  page: PageInfo,
  factors: PageHealthScore['factors'],
  details: { wordCount: number; lastModified?: string }
): string[] {
  const recommendations: string[] = [];

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

  if (factors.depth <= 4) {
    recommendations.push('Page is deeply nested. Consider restructuring for better discoverability.');
  }

  if (factors.commentActivity <= 5) {
    recommendations.push('No comments or discussion. Consider soliciting team review.');
  }

  if (details.wordCount < 50) {
    recommendations.push('Page has very little content. Consider expanding or removing if no longer needed.');
  } else if (details.wordCount < 200) {
    recommendations.push('Page is relatively short. Consider whether it should be merged with a parent page.');
  }

  if (!factors.hasChildren && (page.depth === 0 || page.depth === 1) && details.wordCount < 200) {
    recommendations.push('Root-level page with minimal content and no children. May be a stub page.');
  }

  return recommendations;
}

export function buildChildrenIndex(pages: PageInfo[]): Map<string, Set<string>> {
  const childrenOf = new Map<string, Set<string>>();
  for (const page of pages) {
    if (page.parentId) {
      const siblings = childrenOf.get(page.parentId) ?? new Set();
      siblings.add(page.id);
      childrenOf.set(page.parentId, siblings);
    }
  }
  return childrenOf;
}

export function computeScores(
  pages: PageInfo[],
  comments: { footerComments: CommentInfo[]; inlineComments: CommentInfo[] },
  pageDetails: Record<string, { wordCount: number; lastModified?: string }>,
  childrenOf: Map<string, Set<string>>
): HealthScoringData {
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
