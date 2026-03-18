import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '../_rateLimit';
import type { RiskScoringData, ProjectRiskScore, RiskDimension, RiskLevel, PolicyRecommendation, ComplianceHit, PortfolioProject, PortfolioSpace } from '@/types/api';

const InputSchema = z.object({
  projects: z.array(z.object({
    key: z.string(),
    name: z.string(),
    issueCount: z.number().optional(),
  })),
  spaces: z.array(z.object({
    key: z.string(),
    name: z.string(),
    pageCount: z.number().optional(),
  })),
  hits: z.array(z.object({
    keyword: z.string(),
    source: z.string(),
    projectOrSpace: z.string(),
    title: z.string(),
  })),
}).strict();

const COMPLIANCE_FRAMEWORKS: Record<string, string[]> = {
  HIPAA: ['PHI', 'HIPAA', 'patient', 'healthcare'],
  SOC2: ['SOC2', 'audit', 'access control'],
  'PCI-DSS': ['PCI', 'credit card', 'payment', 'cardholder'],
  FERPA: ['FERPA', 'student', 'education'],
  FedRAMP: ['FedRAMP', 'federal', 'government'],
  GDPR: ['GDPR', 'consent', 'data subject'],
};

function computeLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function scorePiiExposure(hits: ComplianceHit[], key: string): RiskDimension {
  const piiHits = hits.filter(
    (h) => h.projectOrSpace === key && ['PHI', 'PII', 'patient', 'credit card'].includes(h.keyword)
  );
  const score = Math.min(100, piiHits.length * 20);
  return {
    dimension: 'PII Exposure',
    score,
    level: computeLevel(score),
    details: piiHits.length > 0
      ? `${piiHits.length} PII-related items found`
      : 'No PII indicators detected',
  };
}

function scoreComplianceCoverage(hits: ComplianceHit[], key: string): RiskDimension {
  const complianceHits = hits.filter(
    (h) => h.projectOrSpace === key && ['HIPAA', 'SOC2', 'PCI', 'FERPA', 'FedRAMP', 'encryption'].includes(h.keyword)
  );
  // More compliance docs = lower risk
  const coverage = Math.min(100, complianceHits.length * 15);
  const score = Math.max(0, 100 - coverage);
  return {
    dimension: 'Compliance Gaps',
    score,
    level: computeLevel(score),
    details: complianceHits.length > 0
      ? `${complianceHits.length} compliance references found — ${coverage >= 60 ? 'good coverage' : 'needs improvement'}`
      : 'No compliance documentation detected — high gap risk',
  };
}

function scoreStaleDocumentation(hits: ComplianceHit[], key: string, pageCount: number): RiskDimension {
  const docHits = hits.filter((h) => h.projectOrSpace === key && h.source === 'confluence');
  // Low doc count relative to project activity = higher risk
  const docRatio = pageCount > 0 ? Math.min(1, docHits.length / Math.max(pageCount, 1)) : 0;
  const score = Math.max(0, Math.round(100 - docRatio * 100));
  return {
    dimension: 'Documentation Freshness',
    score,
    level: computeLevel(score),
    details: docHits.length > 0
      ? `${docHits.length} compliance docs found across ${pageCount} pages`
      : 'No compliance-related documentation found',
  };
}

function scoreSecurityIssues(hits: ComplianceHit[], key: string): RiskDimension {
  const securityHits = hits.filter(
    (h) => h.projectOrSpace === key && h.source === 'jira' && ['encryption', 'PII', 'PHI'].includes(h.keyword)
  );
  const score = Math.min(100, securityHits.length * 25);
  return {
    dimension: 'Open Security Issues',
    score,
    level: computeLevel(score),
    details: securityHits.length > 0
      ? `${securityHits.length} security-related issues flagged`
      : 'No open security issues detected',
  };
}

function getRecommendations(
  scores: ProjectRiskScore[],
  hits: ComplianceHit[]
): PolicyRecommendation[] {
  const recommendations: PolicyRecommendation[] = [];

  for (const projectScore of scores) {
    const key = projectScore.key;
    const projectHits = hits.filter((h) => h.projectOrSpace === key);
    const keywords = new Set(projectHits.map((h) => h.keyword));

    // PII Shield for projects with PII/PHI
    if (keywords.has('PHI') || keywords.has('PII') || keywords.has('patient')) {
      recommendations.push({
        projectKey: key,
        projectName: projectScore.name,
        templateId: 'pii_shield',
        templateName: 'PII Shield',
        reason: `Contains ${projectHits.filter((h) => ['PHI', 'PII', 'patient'].includes(h.keyword)).length} PII/PHI references — redaction recommended`,
        severity: 'high',
      });
    }

    // Approval for Writes for regulated projects
    if (keywords.has('HIPAA') || keywords.has('PCI') || keywords.has('FedRAMP')) {
      recommendations.push({
        projectKey: key,
        projectName: projectScore.name,
        templateId: 'approval_for_writes',
        templateName: 'Approval for Writes',
        reason: `Regulated project (${Array.from(keywords).filter((k) => ['HIPAA', 'PCI', 'FedRAMP', 'SOC2'].includes(k)).join(', ')}) — write operations need human approval`,
        severity: 'high',
      });
    }

    // Audit Everything for projects with compliance gaps
    const complianceGap = projectScore.dimensions.find((d) => d.dimension === 'Compliance Gaps');
    if (complianceGap && complianceGap.level === 'critical') {
      recommendations.push({
        projectKey: key,
        projectName: projectScore.name,
        templateId: 'audit_everything',
        templateName: 'Audit Everything',
        reason: 'Compliance documentation coverage is critical — enable full audit logging for visibility',
        severity: 'medium',
      });
    }

    // Read-Only for projects with high PII exposure
    const piiDim = projectScore.dimensions.find((d) => d.dimension === 'PII Exposure');
    if (piiDim && piiDim.level === 'critical') {
      recommendations.push({
        projectKey: key,
        projectName: projectScore.name,
        templateId: 'read_only_jira',
        templateName: 'Read-Only Jira',
        reason: 'High PII exposure risk — restrict to read-only access until data classification is complete',
        severity: 'high',
      });
    }
  }

  return recommendations;
}

export async function POST(req: Request) {
  const rateLimited = rateLimit(req);
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const input = InputSchema.parse(body);

    const scores: ProjectRiskScore[] = [];

    // Score each project
    for (const project of input.projects) {
      const dimensions: RiskDimension[] = [
        scorePiiExposure(input.hits as ComplianceHit[], project.key),
        scoreComplianceCoverage(input.hits as ComplianceHit[], project.key),
        scoreStaleDocumentation(input.hits as ComplianceHit[], project.key, 0),
        scoreSecurityIssues(input.hits as ComplianceHit[], project.key),
      ];
      const overallScore = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);
      scores.push({
        key: project.key,
        name: project.name,
        type: 'project',
        overallScore,
        overallLevel: computeLevel(overallScore),
        dimensions,
      });
    }

    // Score each space
    for (const space of input.spaces) {
      const dimensions: RiskDimension[] = [
        scorePiiExposure(input.hits as ComplianceHit[], space.key),
        scoreComplianceCoverage(input.hits as ComplianceHit[], space.key),
        scoreStaleDocumentation(input.hits as ComplianceHit[], space.key, space.pageCount ?? 0),
        scoreSecurityIssues(input.hits as ComplianceHit[], space.key),
      ];
      const overallScore = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);
      scores.push({
        key: space.key,
        name: space.name,
        type: 'space',
        overallScore,
        overallLevel: computeLevel(overallScore),
        dimensions,
      });
    }

    const recommendations = getRecommendations(scores, input.hits as ComplianceHit[]);

    const result: RiskScoringData = { scores, recommendations };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
