'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Shield,
  Eye,
  EyeOff,
  Fingerprint,
  Info,
} from 'lucide-react';
import { PolicyTemplateCard } from '@/components/PolicyTemplateCard';
import { ApprovalSimulator } from '@/components/ApprovalSimulator';
import { SecurityPipeline } from '@/components/SecurityPipeline';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { evaluatePolicy, SIMULATED_TOOL_CALLS, PII_DEMO_TEXT } from '@/lib/policy-evaluator';
import type { PolicyTemplate, PolicyDecision } from '@/types/api';

interface GovernanceControlRoomProps {
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Policy Templates (mirrors gateway ATLASSIAN_POLICY_TEMPLATES)
// ---------------------------------------------------------------------------

const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: 'read_only_jira',
    name: 'Read-Only Jira',
    description: 'Agents can search and view Jira issues but cannot create, update, or transition them.',
    category: 'access',
    rules: [
      {
        name: 'Block Jira writes',
        description: 'Deny all Jira write operations',
        priority: 100,
        conditions: { tools: ['*create_issue*', '*update_issue*', '*transition_issue*', '*delete_issue*', '*add_comment*', '*edit_comment*', '*assign_issue*'] },
        action: 'deny',
      },
      {
        name: 'Allow Jira reads',
        description: 'Allow all Jira read operations',
        priority: 200,
        conditions: { tools: ['*search*', '*get_issue*', '*get_project*', '*list_*'] },
        action: 'allow',
      },
    ],
  },
  {
    id: 'protected_projects',
    name: 'Protected Projects',
    description: 'Block all agent access to specific Jira projects (e.g., HR, Security, Finance).',
    category: 'access',
    rules: [
      {
        name: 'Block protected project access',
        description: 'Deny all tool calls to servers matching protected project patterns',
        priority: 50,
        conditions: { servers: ['*HR*', '*SEC*', '*FIN*'] },
        action: 'deny',
      },
    ],
  },
  {
    id: 'approval_for_writes',
    name: 'Approval for Writes',
    description: 'Any create, update, or transition operation requires human approval before execution.',
    category: 'access',
    rules: [
      {
        name: 'Require approval for Jira writes',
        description: 'HITL approval for all Jira modification operations',
        priority: 100,
        conditions: { tools: ['*create_issue*', '*update_issue*', '*transition_issue*', '*delete_issue*', '*add_comment*', '*assign_issue*'] },
        action: 'require_approval',
      },
      {
        name: 'Require approval for Confluence writes',
        description: 'HITL approval for all Confluence modification operations',
        priority: 100,
        conditions: { tools: ['*create_page*', '*update_page*', '*delete_page*'] },
        action: 'require_approval',
      },
    ],
  },
  {
    id: 'confluence_view_only',
    name: 'Confluence View-Only',
    description: 'Agents can search and read Confluence pages but cannot create or edit them.',
    category: 'access',
    rules: [
      {
        name: 'Block Confluence writes',
        description: 'Deny all Confluence write operations',
        priority: 100,
        conditions: { tools: ['*create_page*', '*update_page*', '*delete_page*', '*create_space*'] },
        action: 'deny',
      },
      {
        name: 'Allow Confluence reads',
        description: 'Allow all Confluence read operations',
        priority: 200,
        conditions: { tools: ['*search*', '*get_page*', '*get_space*', '*list_*'] },
        action: 'allow',
      },
    ],
  },
  {
    id: 'audit_everything',
    name: 'Audit Everything',
    description: 'Maximum visibility — log all calls with no blocking. Ideal for understanding agent behavior.',
    category: 'compliance',
    rules: [
      {
        name: 'Log all tool calls',
        description: 'Log every tool call for audit trail',
        priority: 1000,
        conditions: { tools: ['*'] },
        action: 'log_only',
      },
    ],
  },
  {
    id: 'pii_shield',
    name: 'PII Shield',
    description: 'Scan all content for PII (SSN, credit cards, emails, phone numbers) and redact matches.',
    category: 'security',
    rules: [
      {
        name: 'PII scanning and redaction',
        description: 'Scan and redact PII from all tool responses',
        priority: 100,
        conditions: { tools: ['*'] },
        action: 'allow',
        modifiers: { redactPII: true },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Decision display helpers
// ---------------------------------------------------------------------------

const DECISION_CONFIG: Record<PolicyDecision, {
  icon: typeof CheckCircle2;
  label: string;
  variant: 'green' | 'red' | 'amber' | 'blue';
  blockStage?: string;
}> = {
  allow: { icon: CheckCircle2, label: 'Allowed', variant: 'green' },
  deny: { icon: XCircle, label: 'Denied', variant: 'red', blockStage: 'policy' },
  require_approval: { icon: Clock, label: 'Approval Required', variant: 'amber' },
  log_only: { icon: FileText, label: 'Logged', variant: 'blue' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GovernanceControlRoom({ onBack }: GovernanceControlRoomProps) {
  const [activeTemplates, setActiveTemplates] = useState<Set<string>>(new Set());
  const [approvalStates, setApprovalStates] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({});
  const [showPiiDemo, setShowPiiDemo] = useState(false);
  const [redactedText, setRedactedText] = useState<string | null>(null);
  const [isRedacting, setIsRedacting] = useState(false);

  // Determine if PII Shield is active
  const piiShieldActive = activeTemplates.has('pii_shield');

  // Show PII demo when PII Shield is toggled on
  useEffect(() => {
    if (piiShieldActive && !showPiiDemo) {
      setShowPiiDemo(true);
    } else if (!piiShieldActive) {
      setShowPiiDemo(false);
      setRedactedText(null);
    }
  }, [piiShieldActive, showPiiDemo]);

  // Fetch redaction when PII demo becomes visible
  useEffect(() => {
    if (!showPiiDemo || redactedText !== null) return;

    let cancelled = false;
    setIsRedacting(true);

    (async () => {
      try {
        const res = await fetch('/api/tools/security-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: PII_DEMO_TEXT, mode: 'redact' }),
        });
        const data = await res.json();
        if (!cancelled) {
          setRedactedText(data.redactedText ?? PII_DEMO_TEXT.replace(/\d{3}-\d{2}-\d{4}/g, '[REDACTED]'));
        }
      } catch {
        if (!cancelled) {
          // Fallback: simple local redaction for demo purposes
          setRedactedText(
            PII_DEMO_TEXT
              .replace(/\d{3}-\d{2}-\d{4}/g, '[REDACTED-SSN]')
              .replace(/4111\d{12}/g, '[REDACTED-CC]')
              .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[REDACTED-EMAIL]')
              .replace(/\(\d{3}\)\s?\d{3}-\d{4}/g, '[REDACTED-PHONE]')
              .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '[REDACTED-IP]')
              .replace(/\d{2}\/\d{2}\/\d{4}/g, '[REDACTED-DOB]')
              .replace(/MRN:\s*\d+/g, 'MRN: [REDACTED-MRN]')
          );
        }
      } finally {
        if (!cancelled) setIsRedacting(false);
      }
    })();

    return () => { cancelled = true; };
  }, [showPiiDemo, redactedText]);

  const handleToggleTemplate = useCallback((id: string) => {
    setActiveTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // Reset approval states when templates change
    setApprovalStates({});
  }, []);

  const handleApprove = useCallback((toolName: string) => {
    setApprovalStates((prev) => ({ ...prev, [toolName]: 'approved' }));
  }, []);

  const handleReject = useCallback((toolName: string) => {
    setApprovalStates((prev) => ({ ...prev, [toolName]: 'rejected' }));
  }, []);

  // Compute active template objects for policy evaluation
  const activeTemplateObjects = POLICY_TEMPLATES.filter((t) => activeTemplates.has(t.id));

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-anthropic-900 mb-1">
              Governance Control Room
            </h1>
            <p className="text-sm text-gray-500 max-w-xl leading-relaxed">
              Toggle policy templates on the left and watch how they change the decision
              for every tool call on the right — deny, approve, or log in real time.
            </p>
          </div>
          <Badge variant="blue" size="md">VP Engineering / IT Governance</Badge>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel: Policy Templates */}
        <div className="w-full lg:w-[38%] shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-anthropic-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-claude-orange" />
              Policy Templates
            </h2>
            <Badge variant={activeTemplates.size > 0 ? 'green' : 'gray'}>
              {activeTemplates.size} active
            </Badge>
          </div>
          <div className="space-y-3">
            {POLICY_TEMPLATES.map((template) => (
              <PolicyTemplateCard
                key={template.id}
                template={template}
                isActive={activeTemplates.has(template.id)}
                onToggle={handleToggleTemplate}
              />
            ))}
          </div>
        </div>

        {/* Right Panel: Tool Call Simulator */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-anthropic-900">
              Tool Call Decisions
            </h2>
            <Badge variant="gray">
              {activeTemplates.size} template{activeTemplates.size !== 1 ? 's' : ''} active
            </Badge>
          </div>

          {activeTemplates.size === 0 ? (
            <Card variant="default" className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Info className="w-7 h-7 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">
                No policies active
              </h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                Enable policy templates on the left to see how they affect tool call
                decisions through the MCP Security Gateway.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {SIMULATED_TOOL_CALLS.map((toolCall) => {
                const result = evaluatePolicy(activeTemplateObjects, toolCall.toolName);
                const config = DECISION_CONFIG[result.decision];
                const DecisionIcon = config.icon;

                return (
                  <Card
                    key={toolCall.toolName}
                    variant="default"
                    padding="sm"
                    className="animate-fade-in"
                  >
                    {/* Tool header */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <DecisionIcon className={`w-5 h-5 shrink-0 text-${config.variant}-600`} />
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {toolCall.displayName}
                        </span>
                        <Badge variant={toolCall.type === 'write' ? 'amber' : 'blue'}>
                          {toolCall.type}
                        </Badge>
                      </div>
                      <Badge variant={config.variant} size="md">
                        {config.label}
                      </Badge>
                    </div>

                    {/* Matched rule */}
                    {result.matchedRule && (
                      <p className="text-xs text-gray-400 mb-3">
                        Matched: <span className="text-gray-500 font-medium">{result.matchedRule}</span>
                        {result.matchedTemplate && (
                          <span className="ml-1 text-gray-400">({result.matchedTemplate})</span>
                        )}
                      </p>
                    )}

                    {/* Approval simulator for require_approval decisions */}
                    {result.decision === 'require_approval' ? (
                      <ApprovalSimulator
                        toolName={toolCall.toolName}
                        displayName={toolCall.displayName}
                        exampleParams={toolCall.exampleParams}
                        onApprove={() => handleApprove(toolCall.toolName)}
                        onReject={() => handleReject(toolCall.toolName)}
                        decision={approvalStates[toolCall.toolName] ?? 'pending'}
                      />
                    ) : (
                      /* Compact SecurityPipeline for non-approval decisions */
                      <SecurityPipeline
                        toolName={toolCall.toolName}
                        parameters={toolCall.exampleParams}
                        isGenerating={false}
                        isWriteOperation={toolCall.type === 'write'}
                        blocked={result.decision === 'deny'}
                        blockStage={config.blockStage}
                      />
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* PII Redaction Demo */}
      {showPiiDemo && (
        <div className="mt-8 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Fingerprint className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-bold text-anthropic-900">
              PII Redaction Demo
            </h2>
            <Badge variant="red">PII Shield Active</Badge>
          </div>
          <p className="text-sm text-gray-500 mb-4 max-w-xl">
            The PII Shield scans all tool responses for sensitive data — SSN, credit cards, emails,
            phone numbers, IP addresses, dates of birth, and medical record numbers — and redacts
            matches before the content reaches the AI agent.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Eye className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold text-red-700">Original Response</span>
              </div>
              <Card variant="default" padding="none" className="border-red-200 overflow-hidden">
                <pre className="p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap break-words leading-relaxed bg-red-50/30">
                  {PII_DEMO_TEXT.split('\n').map((line, i) => {
                    // Highlight PII patterns with red underline
                    const piiPatterns = [
                      /\d{3}-\d{2}-\d{4}/g,          // SSN
                      /4111\d{12}/g,                   // Credit card
                      /[\w.-]+@[\w.-]+\.\w+/g,        // Email
                      /\(\d{3}\)\s?\d{3}-\d{4}/g,     // Phone
                      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, // IP
                      /\d{2}\/\d{2}\/\d{4}/g,         // DOB
                      /MRN:\s*\d+/g,                   // MRN
                    ];

                    let highlighted = line;
                    let hasMatch = false;
                    for (const pattern of piiPatterns) {
                      if (pattern.test(line)) {
                        hasMatch = true;
                        break;
                      }
                    }

                    if (hasMatch) {
                      // Reset patterns (regex with /g flag keeps lastIndex state)
                      let result = line;
                      const allMatches: Array<{ start: number; end: number }> = [];
                      for (const pattern of piiPatterns) {
                        const regex = new RegExp(pattern.source, 'g');
                        let match;
                        while ((match = regex.exec(line)) !== null) {
                          allMatches.push({ start: match.index, end: match.index + match[0].length });
                        }
                      }

                      if (allMatches.length > 0) {
                        // Sort by position descending so we can replace from end to start
                        allMatches.sort((a, b) => b.start - a.start);

                        return (
                          <span key={i} className="block">
                            {renderHighlightedLine(line, allMatches)}
                            {'\n'}
                          </span>
                        );
                      }
                    }

                    return <span key={i} className="block">{highlighted}{'\n'}</span>;
                  })}
                </pre>
              </Card>
            </div>

            {/* Redacted */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <EyeOff className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">Redacted (Agent Sees This)</span>
              </div>
              <Card variant="default" padding="none" className="border-green-200 overflow-hidden">
                {isRedacting ? (
                  <div className="p-4 flex items-center justify-center min-h-[200px]">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                      Running PII scanner...
                    </div>
                  </div>
                ) : (
                  <pre className="p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap break-words leading-relaxed bg-green-50/30">
                    {(redactedText ?? '').split('\n').map((line, i) => {
                      // Highlight [REDACTED...] markers
                      const parts = line.split(/(\[REDACTED[^\]]*\])/g);
                      return (
                        <span key={i} className="block">
                          {parts.map((part, j) =>
                            part.match(/^\[REDACTED/) ? (
                              <span
                                key={j}
                                className="px-1 py-0.5 bg-green-200 text-green-800 rounded font-semibold"
                              >
                                {part}
                              </span>
                            ) : (
                              <span key={j}>{part}</span>
                            )
                          )}
                          {'\n'}
                        </span>
                      );
                    })}
                  </pre>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: render a line with PII matches highlighted
// ---------------------------------------------------------------------------

function renderHighlightedLine(
  line: string,
  matches: Array<{ start: number; end: number }>,
) {
  // Sort ascending by start
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of sorted) {
    if (match.start > cursor) {
      parts.push(<span key={`t-${cursor}`}>{line.slice(cursor, match.start)}</span>);
    }
    parts.push(
      <span
        key={`m-${match.start}`}
        className="underline decoration-red-500 decoration-2 underline-offset-2 text-red-700 font-semibold"
      >
        {line.slice(match.start, match.end)}
      </span>
    );
    cursor = match.end;
  }

  if (cursor < line.length) {
    parts.push(<span key={`t-${cursor}`}>{line.slice(cursor)}</span>);
  }

  return parts;
}
