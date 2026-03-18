import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ATLASSIAN_CLOUD_ID, rovo, extractText } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { ComplianceScanData, ComplianceHit } from '@/types/api';

const InputSchema = z.object({
  projectKeys: z.array(z.string().max(20)).max(10),
  spaceKeys: z.array(z.string().max(20)).max(10),
}).strict();

const COMPLIANCE_KEYWORDS = ['PHI', 'PII', 'HIPAA', 'SOC2', 'PCI', 'encryption', 'patient', 'credit card', 'FERPA', 'FedRAMP'];

function getMockData(): ComplianceScanData {
  const hits: ComplianceHit[] = [
    { keyword: 'PHI', source: 'jira', projectOrSpace: 'HEALTH', title: 'Implement PHI data masking', key: 'HEALTH-12', excerpt: 'All PHI fields must be encrypted at rest...' },
    { keyword: 'HIPAA', source: 'jira', projectOrSpace: 'HEALTH', title: 'HIPAA audit trail requirements', key: 'HEALTH-23', excerpt: 'Audit logging required for all PHI access...' },
    { keyword: 'patient', source: 'jira', projectOrSpace: 'HEALTH', title: 'Patient intake form validation', key: 'HEALTH-5', excerpt: 'Patient data validation rules for AI intake...' },
    { keyword: 'encryption', source: 'jira', projectOrSpace: 'HEALTH', title: 'Enable TLS 1.3 for API endpoints', key: 'HEALTH-34', excerpt: 'All endpoints must enforce TLS 1.3 encryption...' },
    { keyword: 'PII', source: 'confluence', projectOrSpace: 'HA', title: 'Data Classification Policy', excerpt: 'PII handling procedures for healthcare data...' },
    { keyword: 'HIPAA', source: 'confluence', projectOrSpace: 'HA', title: 'HIPAA Compliance Checklist', excerpt: 'Complete HIPAA compliance verification checklist...' },
    { keyword: 'SOC2', source: 'jira', projectOrSpace: 'FINSERV', title: 'SOC2 Type II certification prep', key: 'FINSERV-8', excerpt: 'Prepare artifacts for SOC2 Type II audit...' },
    { keyword: 'PCI', source: 'jira', projectOrSpace: 'FINSERV', title: 'PCI-DSS tokenization layer', key: 'FINSERV-15', excerpt: 'Credit card tokenization via Stripe...' },
    { keyword: 'credit card', source: 'jira', projectOrSpace: 'FINSERV', title: 'Credit card data handling policy', key: 'FINSERV-22', excerpt: 'No raw credit card numbers in Jira fields...' },
    { keyword: 'encryption', source: 'confluence', projectOrSpace: 'FINS', title: 'Encryption Standards Guide', excerpt: 'AES-256 for data at rest, TLS 1.3 in transit...' },
    { keyword: 'FERPA', source: 'jira', projectOrSpace: 'EDTECH', title: 'FERPA student data protection', key: 'EDTECH-3', excerpt: 'Student records must comply with FERPA...' },
    { keyword: 'PII', source: 'jira', projectOrSpace: 'EDTECH', title: 'Student PII anonymization', key: 'EDTECH-9', excerpt: 'Anonymize all student PII in AI training data...' },
    { keyword: 'FedRAMP', source: 'jira', projectOrSpace: 'GOVSEC', title: 'FedRAMP authorization package', key: 'GOVSEC-1', excerpt: 'Prepare FedRAMP Moderate authorization package...' },
    { keyword: 'encryption', source: 'jira', projectOrSpace: 'GOVSEC', title: 'FIPS 140-2 compliant encryption', key: 'GOVSEC-7', excerpt: 'All cryptographic modules must be FIPS 140-2 certified...' },
  ];

  const scansByProject: Record<string, number> = {};
  const scansByKeyword: Record<string, number> = {};
  for (const hit of hits) {
    scansByProject[hit.projectOrSpace] = (scansByProject[hit.projectOrSpace] ?? 0) + 1;
    scansByKeyword[hit.keyword] = (scansByKeyword[hit.keyword] ?? 0) + 1;
  }

  return { hits, scansByProject, scansByKeyword, source: 'mock' };
}

async function fetchViaGateway(projectKeys: string[], spaceKeys: string[]): Promise<ComplianceScanData> {
  resetSession();
  const hits: ComplianceHit[] = [];

  // Search Jira projects for compliance keywords
  for (const projectKey of projectKeys) {
    for (const keyword of COMPLIANCE_KEYWORDS) {
      try {
        const jql = `project = ${projectKey} AND text ~ "${keyword}" ORDER BY updated DESC`;
        const result = await callTool(rovo('searchJiraIssuesUsingJql'), {
          cloudId: ATLASSIAN_CLOUD_ID,
          jql,
          maxResults: 5,
        });
        if (!result.isError) {
          const data = JSON.parse(extractText(result));
          const issues = data?.issues ?? data ?? [];
          for (const issue of (Array.isArray(issues) ? issues : []).slice(0, 3)) {
            hits.push({
              keyword,
              source: 'jira',
              projectOrSpace: projectKey,
              title: (issue.fields?.summary ?? issue.summary ?? '') as string,
              key: (issue.key ?? '') as string,
              excerpt: ((issue.fields?.description ?? '') as string).slice(0, 150),
            });
          }
        }
      } catch {
        // Continue scanning other keywords
      }
    }
  }

  // Search Confluence spaces for compliance keywords
  for (const spaceKey of spaceKeys) {
    for (const keyword of COMPLIANCE_KEYWORDS) {
      try {
        const cql = `space = "${spaceKey}" AND text ~ "${keyword}" ORDER BY lastModified DESC`;
        const result = await callTool(rovo('searchConfluenceUsingCql'), {
          cloudId: ATLASSIAN_CLOUD_ID,
          cql,
          limit: 3,
        });
        if (!result.isError) {
          const data = JSON.parse(extractText(result));
          const pages = data?.results ?? data ?? [];
          for (const page of (Array.isArray(pages) ? pages : []).slice(0, 3)) {
            hits.push({
              keyword,
              source: 'confluence',
              projectOrSpace: spaceKey,
              title: (page.title ?? '') as string,
              excerpt: ((page.excerpt ?? '') as string).slice(0, 150),
            });
          }
        }
      } catch {
        // Continue scanning
      }
    }
  }

  const scansByProject: Record<string, number> = {};
  const scansByKeyword: Record<string, number> = {};
  for (const hit of hits) {
    scansByProject[hit.projectOrSpace] = (scansByProject[hit.projectOrSpace] ?? 0) + 1;
    scansByKeyword[hit.keyword] = (scansByKeyword[hit.keyword] ?? 0) + 1;
  }

  return { hits, scansByProject, scansByKeyword, source: 'gateway' };
}

export async function POST(req: Request) {
  const rateLimited = rateLimit(req);
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const input = InputSchema.parse(body);

    if (!isConfigured()) {
      return NextResponse.json(getMockData());
    }
    const data = await fetchViaGateway(input.projectKeys, input.spaceKeys);
    return NextResponse.json(data);
  } catch (err) {
    console.error('compliance-scan error:', err);
    return NextResponse.json(getMockData());
  }
}
