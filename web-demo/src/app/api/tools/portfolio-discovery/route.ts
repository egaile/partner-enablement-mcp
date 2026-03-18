import { NextResponse } from 'next/server';
import { callTool, isConfigured, resetSession } from '@/lib/gateway-client';
import { ATLASSIAN_CLOUD_ID, rovo, extractText } from '../_shared';
import { rateLimit } from '../_rateLimit';
import type { PortfolioDiscoveryData, PortfolioProject, PortfolioSpace, PortfolioUser } from '@/types/api';

function getMockData(): PortfolioDiscoveryData {
  return {
    projects: [
      { key: 'HEALTH', name: 'Healthcare AI Platform', description: 'AI-powered patient intake with HIPAA compliance', lead: 'Dr. Sarah Chen', issueCount: 47, lastActivity: '2026-03-17' },
      { key: 'FINSERV', name: 'Financial Services AI', description: 'Document processing and fraud detection for banking', lead: 'James Rodriguez', issueCount: 32, lastActivity: '2026-03-16' },
      { key: 'EDTECH', name: 'Education AI Assistant', description: 'Personalized learning platform with FERPA compliance', lead: 'Maya Patel', issueCount: 21, lastActivity: '2026-03-12' },
      { key: 'GOVSEC', name: 'Government Security AI', description: 'FedRAMP-compliant threat detection system', lead: 'Col. Tom Webb', issueCount: 15, lastActivity: '2026-03-08' },
    ],
    spaces: [
      { key: 'HA', name: 'Healthcare Architecture', description: 'Architecture docs for HIPAA-compliant AI systems', pageCount: 12, lastActivity: '2026-03-15' },
      { key: 'FINS', name: 'Financial Services Docs', description: 'SOC2 and PCI-DSS compliance documentation', pageCount: 8, lastActivity: '2026-03-14' },
      { key: 'EDU', name: 'Education Docs', description: 'FERPA compliance and student data policies', pageCount: 5, lastActivity: '2026-03-10' },
    ],
    user: { accountId: 'demo-user-001', displayName: 'Demo Enterprise Admin', emailAddress: 'admin@enterprise.com', active: true },
    source: 'mock',
  };
}

async function fetchViaGateway(): Promise<PortfolioDiscoveryData> {
  resetSession();

  // Step 1: Get user info (atlassianUserInfo — 30th tool)
  let user: PortfolioUser = { accountId: 'unknown', displayName: 'Unknown', active: true };
  try {
    const userResult = await callTool(rovo('atlassianUserInfo'), { cloudId: ATLASSIAN_CLOUD_ID });
    if (!userResult.isError) {
      const userData = JSON.parse(extractText(userResult));
      user = {
        accountId: userData.accountId ?? 'unknown',
        displayName: userData.displayName ?? 'Unknown',
        emailAddress: userData.emailAddress,
        active: userData.active ?? true,
      };
    }
  } catch {
    // Fall through — user info is optional
  }

  // Step 2: Get all visible Jira projects
  const projectsResult = await callTool(rovo('getVisibleJiraProjects'), { cloudId: ATLASSIAN_CLOUD_ID });
  if (projectsResult.isError) throw new Error(`Tool error: ${extractText(projectsResult)}`);
  const projectsData = JSON.parse(extractText(projectsResult));
  const rawProjects = projectsData?.values ?? projectsData ?? [];

  const projects: PortfolioProject[] = (Array.isArray(rawProjects) ? rawProjects : []).map(
    (p: Record<string, unknown>) => ({
      key: (p.key as string) ?? '',
      name: (p.name as string) ?? '',
      description: (p.description as string) ?? undefined,
      lead: ((p.lead as Record<string, unknown>)?.displayName as string) ?? undefined,
      issueCount: 0, // enriched below
      lastActivity: undefined,
    })
  );

  // Step 3: Get all Confluence spaces
  const spacesResult = await callTool(rovo('getConfluenceSpaces'), { cloudId: ATLASSIAN_CLOUD_ID });
  if (spacesResult.isError) throw new Error(`Tool error: ${extractText(spacesResult)}`);
  const spacesData = JSON.parse(extractText(spacesResult));
  const rawSpaces = spacesData?.results ?? spacesData ?? [];

  const spaces: PortfolioSpace[] = (Array.isArray(rawSpaces) ? rawSpaces : []).map(
    (s: Record<string, unknown>) => ({
      key: (s.key as string) ?? '',
      name: (s.name as string) ?? '',
      description: (s.description as string) ?? undefined,
      pageCount: 0,
      lastActivity: undefined,
    })
  );

  return { projects, spaces, user, source: 'gateway' };
}

export async function POST(req: Request) {
  const rateLimited = rateLimit(req);
  if (rateLimited) return rateLimited;

  try {
    if (!isConfigured()) {
      return NextResponse.json(getMockData());
    }
    const data = await fetchViaGateway();
    return NextResponse.json(data);
  } catch (err) {
    console.error('portfolio-discovery error:', err);
    return NextResponse.json(getMockData());
  }
}
