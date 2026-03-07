import { NextResponse } from 'next/server';
import { rateLimit } from '../_rateLimit';

const GATEWAY_URL = process.env.GATEWAY_URL;
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY;

export interface AuditEntry {
  id: string;
  correlation_id: string;
  tool_name: string;
  server_name: string;
  policy_decision: 'allow' | 'deny' | 'require_approval' | 'log_only';
  threats_detected: number;
  threat_details?: {
    atlassian?: {
      projectKey?: string;
      issueKey?: string;
      spaceKey?: string;
      operationType?: string;
      isWriteOperation?: boolean;
    };
  };
  drift_detected: boolean;
  latency_ms: number;
  request_pii_detected: boolean;
  response_pii_detected: boolean;
  success: boolean;
  error_message?: string;
  created_at: string;
}

export interface AuditTrailResponse {
  data: AuditEntry[];
  count: number;
}

function getMockAuditTrail(): AuditTrailResponse {
  const now = Date.now();
  const entries: AuditEntry[] = [
    {
      id: 'mock-1',
      correlation_id: 'corr-001',
      tool_name: 'getAccessibleAtlassianResources',
      server_name: 'atlassian-rovo',
      policy_decision: 'allow',
      threats_detected: 0,
      drift_detected: false,
      latency_ms: 45,
      request_pii_detected: false,
      response_pii_detected: false,
      success: true,
      created_at: new Date(now - 60000).toISOString(),
    },
    {
      id: 'mock-2',
      correlation_id: 'corr-002',
      tool_name: 'getVisibleJiraProjects',
      server_name: 'atlassian-rovo',
      policy_decision: 'allow',
      threats_detected: 0,
      threat_details: { atlassian: { operationType: 'list_projects' } },
      drift_detected: false,
      latency_ms: 120,
      request_pii_detected: false,
      response_pii_detected: false,
      success: true,
      created_at: new Date(now - 55000).toISOString(),
    },
    {
      id: 'mock-3',
      correlation_id: 'corr-003',
      tool_name: 'searchJiraIssuesUsingJql',
      server_name: 'atlassian-rovo',
      policy_decision: 'allow',
      threats_detected: 0,
      threat_details: { atlassian: { projectKey: 'HEALTH', operationType: 'search_issues' } },
      drift_detected: false,
      latency_ms: 230,
      request_pii_detected: false,
      response_pii_detected: true,
      success: true,
      created_at: new Date(now - 50000).toISOString(),
    },
    {
      id: 'mock-4',
      correlation_id: 'corr-004',
      tool_name: 'search',
      server_name: 'atlassian-rovo',
      policy_decision: 'allow',
      threats_detected: 0,
      threat_details: { atlassian: { operationType: 'rovo_search' } },
      drift_detected: false,
      latency_ms: 180,
      request_pii_detected: false,
      response_pii_detected: false,
      success: true,
      created_at: new Date(now - 45000).toISOString(),
    },
    {
      id: 'mock-5',
      correlation_id: 'corr-005',
      tool_name: 'searchConfluenceUsingCql',
      server_name: 'atlassian-rovo',
      policy_decision: 'allow',
      threats_detected: 0,
      threat_details: { atlassian: { operationType: 'search_confluence', spaceKey: 'HA' } },
      drift_detected: false,
      latency_ms: 95,
      request_pii_detected: false,
      response_pii_detected: false,
      success: true,
      created_at: new Date(now - 40000).toISOString(),
    },
    {
      id: 'mock-6',
      correlation_id: 'corr-006',
      tool_name: 'getConfluencePage',
      server_name: 'atlassian-rovo',
      policy_decision: 'allow',
      threats_detected: 0,
      threat_details: { atlassian: { spaceKey: 'HA', operationType: 'read_page' } },
      drift_detected: false,
      latency_ms: 78,
      request_pii_detected: false,
      response_pii_detected: false,
      success: true,
      created_at: new Date(now - 35000).toISOString(),
    },
    {
      id: 'mock-7',
      correlation_id: 'corr-007',
      tool_name: 'editJiraIssue',
      server_name: 'atlassian-rovo',
      policy_decision: 'allow',
      threats_detected: 0,
      threat_details: { atlassian: { issueKey: 'HEALTH-1', operationType: 'update_issue', isWriteOperation: true } },
      drift_detected: false,
      latency_ms: 150,
      request_pii_detected: false,
      response_pii_detected: false,
      success: true,
      created_at: new Date(now - 30000).toISOString(),
    },
    {
      id: 'mock-8',
      correlation_id: 'corr-008',
      tool_name: 'createConfluencePage',
      server_name: 'atlassian-rovo',
      policy_decision: 'deny',
      threats_detected: 0,
      threat_details: { atlassian: { operationType: 'create_page', isWriteOperation: true } },
      drift_detected: false,
      latency_ms: 12,
      request_pii_detected: false,
      response_pii_detected: false,
      success: false,
      error_message: 'Policy denied: write operations to Confluence require approval',
      created_at: new Date(now - 25000).toISOString(),
    },
    {
      id: 'mock-9',
      correlation_id: 'corr-009',
      tool_name: 'addCommentToJiraIssue',
      server_name: 'atlassian-rovo',
      policy_decision: 'allow',
      threats_detected: 0,
      threat_details: { atlassian: { issueKey: 'HEALTH-3', operationType: 'add_comment', isWriteOperation: true } },
      drift_detected: false,
      latency_ms: 110,
      request_pii_detected: false,
      response_pii_detected: false,
      success: true,
      created_at: new Date(now - 20000).toISOString(),
    },
    {
      id: 'mock-10',
      correlation_id: 'corr-010',
      tool_name: 'transitionJiraIssue',
      server_name: 'atlassian-rovo',
      policy_decision: 'require_approval',
      threats_detected: 0,
      threat_details: { atlassian: { issueKey: 'HEALTH-5', operationType: 'transition_issue', isWriteOperation: true } },
      drift_detected: false,
      latency_ms: 8,
      request_pii_detected: false,
      response_pii_detected: false,
      success: false,
      error_message: 'Requires human approval before executing status transition',
      created_at: new Date(now - 15000).toISOString(),
    },
  ];

  return { data: entries, count: entries.length };
}

export async function GET(request: Request) {
  const rateLimited = rateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    if (!GATEWAY_URL || !GATEWAY_API_KEY) {
      return NextResponse.json(getMockAuditTrail());
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '20';
    const offset = searchParams.get('offset') || '0';

    const res = await fetch(
      `${GATEWAY_URL}/api/demo/audit-trail?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${GATEWAY_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      console.warn(`[audit-trail] Gateway returned ${res.status}, falling back to mock`);
      return NextResponse.json(getMockAuditTrail());
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.warn(
      '[audit-trail] Failed to fetch from gateway, falling back to mock:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(getMockAuditTrail());
  }
}
