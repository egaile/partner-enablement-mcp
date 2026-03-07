import { Shield, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

type CalloutTheme = 'info' | 'security' | 'success' | 'atlassian';

interface SecurityCalloutProps {
  theme: CalloutTheme;
  children: React.ReactNode;
}

const themeConfig: Record<CalloutTheme, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: <Info className="w-4 h-4 text-blue-500" />,
  },
  security: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: <Shield className="w-4 h-4 text-amber-500" />,
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  },
  atlassian: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-800',
    icon: <AlertTriangle className="w-4 h-4 text-purple-500" />,
  },
};

export function SecurityCallout({ theme, children }: SecurityCalloutProps) {
  const config = themeConfig[theme];

  return (
    <div className={`flex items-start gap-2.5 ${config.bg} ${config.border} border rounded-lg px-4 py-3`}>
      <div className="shrink-0 mt-0.5">{config.icon}</div>
      <div className={`text-xs ${config.text} leading-relaxed`}>{children}</div>
    </div>
  );
}

// Pre-built callouts for common scenarios
export function PiiDetectedCallout() {
  return (
    <SecurityCallout theme="security">
      The gateway detected PII/PHI patterns in Jira issue descriptions. In production, the PII scanner would redact
      sensitive data before it reaches the AI agent, preventing accidental data exposure.
    </SecurityCallout>
  );
}

export function WriteBlockedCallout() {
  return (
    <SecurityCallout theme="security">
      This demonstrates the Read-Only Jira policy template. The gateway evaluated the tool call against
      active policies and blocked the write operation before it reached Atlassian.
    </SecurityCallout>
  );
}

export function ConfluenceSearchCallout() {
  return (
    <SecurityCallout theme="atlassian">
      The agent used CQL (Confluence Query Language) to search existing team documentation. This shows
      how AI agents can discover and reference your organization&apos;s knowledge base contextually.
    </SecurityCallout>
  );
}

export function LiveDataCallout() {
  return (
    <SecurityCallout theme="success">
      <strong>Data source: Live via Gateway.</strong> This data was fetched in real-time from Jira Cloud
      through the MCP Security Gateway, with full audit logging and security scanning.
    </SecurityCallout>
  );
}

export function MockDataCallout() {
  return (
    <SecurityCallout theme="info">
      <strong>Data source: Mock (gateway unavailable).</strong> Displaying demonstration data.
      Connect a gateway API key to see live Atlassian data.
    </SecurityCallout>
  );
}
