import { CheckCircle2, RotateCcw, Github, Linkedin, ExternalLink } from 'lucide-react';
import type { ProjectContextData, ArchitectureData, ComplianceData, PlanData } from '@/types/api';
import { Card } from '../ui/Card';

interface CompleteStepProps {
  data: {
    context: ProjectContextData | null;
    architecture: ArchitectureData | null;
    compliance: ComplianceData | null;
    plan: PlanData | null;
  };
  onStartOver: () => void;
}

export function CompleteStep({ data, onStartOver }: CompleteStepProps) {
  const summaryCards = [
    {
      title: 'Project Context',
      stat: data.context ? `${data.context.summary.totalIssues} issues analyzed` : 'Completed',
      tool: 'read_project_context',
    },
    {
      title: 'Architecture',
      stat: data.architecture?.patternName || 'Pattern generated',
      tool: 'generate_architecture',
    },
    {
      title: 'Compliance',
      stat: data.compliance
        ? `${data.compliance.applicableFrameworks.length} frameworks assessed`
        : 'Completed',
      tool: 'assess_compliance',
    },
    {
      title: 'Implementation Plan',
      stat: data.plan ? `${data.plan.summary.totalWeeks}-week plan` : 'Completed',
      tool: 'create_implementation_plan',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Success Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Demo Complete</h2>
        <p className="text-gray-500 max-w-lg mx-auto text-sm">
          Four MCP tools executed through the Security Gateway, producing structured enterprise deliverables from live Jira data.
        </p>
      </div>

      {/* What Was Demonstrated */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <Card key={card.title} className="text-center !p-4">
            <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-2" />
            <h4 className="font-semibold text-gray-900 text-sm mb-1">{card.title}</h4>
            <p className="text-xs text-gray-500">{card.stat}</p>
            <code className="text-[10px] font-mono text-gray-400 mt-1 block">{card.tool}</code>
          </Card>
        ))}
      </div>

      {/* Technical Summary */}
      <Card variant="highlighted">
        <p className="text-sm text-gray-700 leading-relaxed">
          This demo routed Jira reads through the MCP Security Gateway, which proxied them to the
          Atlassian Rovo MCP Server with injection scanning, policy enforcement, and PII detection on
          every call. In production, Claude calls these same tools conversationally while the gateway
          provides the audit trail and guardrails enterprises require.
        </p>
      </Card>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button
          onClick={onStartOver}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          Try Another Scenario
        </button>
        <a
          href="https://github.com/egaile/partner-enablement-mcp"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
        >
          <Github className="w-4 h-4" />
          View Source on GitHub
        </a>
      </div>

      {/* About Section */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">About This Project</h3>
        <p className="text-sm text-gray-600 mb-5 leading-relaxed">
          This demonstration was built to show how Global System Integrators can
          operationalize Claude deployments faster. The MCP server architecture
          enables Claude to read project context from enterprise tools (like Jira) and generate
          compliant, deployment-ready artifacts.
        </p>
        <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
          <div className="w-10 h-10 bg-gradient-to-br from-anthropic-700 to-anthropic-900 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            EG
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 text-sm">Ed Gaile</p>
            <p className="text-xs text-gray-500">Principal Solutions Architect</p>
          </div>
          <div className="flex gap-3">
            <a
              href="https://linkedin.com/in/edgaile"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <Linkedin className="w-3.5 h-3.5" />
              LinkedIn
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://github.com/egaile"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
