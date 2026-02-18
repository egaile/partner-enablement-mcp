'use client';

import { useState, useCallback } from 'react';
import {
  Building2,
  FileCode,
  Shield,
  ClipboardList,
  Play,
  ChevronRight,
  Github,
  Linkedin,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

type Step = 'select' | 'context' | 'architecture' | 'compliance' | 'plan' | 'complete';

interface GeneratedContent {
  context?: string;
  architecture?: string;
  compliance?: string;
  plan?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ProjectContextData {
  project: { key: string; name: string; description?: string; lead?: string };
  issues: Array<{
    key: string;
    summary: string;
    description?: string;
    type: string;
    status: string;
    labels: string[];
    priority?: string;
  }>;
  detectedCompliance: string[];
  detectedIntegrations: string[];
  detectedDataTypes: string[];
  allLabels: string[];
  summary: { totalIssues: number };
}

function formatContextMarkdown(data: ProjectContextData): string {
  let md = `# Project Context: ${data.project.name}\n\n`;
  md += `**Key:** ${data.project.key}\n`;
  md += `**Lead:** ${data.project.lead || 'Not assigned'}\n\n`;

  if (data.project.description) {
    md += `## Description\n${data.project.description}\n\n`;
  }

  if (data.detectedCompliance.length > 0) {
    md += `## Compliance Indicators\n`;
    for (const indicator of data.detectedCompliance) {
      md += `- ⚠️ ${indicator}\n`;
    }
    md += '\n';
  }

  if (data.detectedIntegrations.length > 0) {
    md += `## Detected Integration Targets\n`;
    for (const target of data.detectedIntegrations) {
      md += `- ${target}\n`;
    }
    md += '\n';
  }

  if (data.issues.length > 0) {
    md += `## Recent Issues (${data.issues.length})\n\n`;
    for (const issue of data.issues) {
      md += `### ${issue.key}: ${issue.summary}\n`;
      md += `**Type:** ${issue.type} | **Status:** ${issue.status}`;
      if (issue.priority) {
        md += ` | **Priority:** ${issue.priority}`;
      }
      md += '\n';
      if (issue.labels.length > 0) {
        md += `**Labels:** ${issue.labels.join(', ')}\n`;
      }
      if (issue.description) {
        md += `\n${issue.description.substring(0, 500)}${issue.description.length > 500 ? '...' : ''}\n`;
      }
      md += '\n';
    }
  }

  return md;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatArchitectureMarkdown(data: any): string {
  let md = `# Reference Architecture: ${data.patternName}\n\n`;
  md += `## Pattern Selection\n`;
  md += `**Recommended Pattern:** ${data.patternName}\n\n`;
  md += `**Rationale:** ${data.rationale}\n\n`;

  if (data.mermaidDiagram) {
    md += `## Architecture Diagram\n`;
    md += '```mermaid\n';
    md += data.mermaidDiagram;
    md += '\n```\n\n';
  }

  md += `## Components\n\n`;
  for (const comp of data.components) {
    md += `### ${comp.name}\n`;
    md += `${comp.description}\n\n`;
    const providers = Object.keys(comp.services).filter(k => k !== 'anthropic');
    for (const provider of providers) {
      if (comp.services[provider]?.length > 0) {
        md += `**${provider.toUpperCase()} Services:**\n`;
        for (const service of comp.services[provider]) {
          md += `- ${service}\n`;
        }
      }
    }
    if (comp.services.anthropic?.length > 0) {
      md += `\n**Anthropic Services:**\n`;
      for (const service of comp.services.anthropic) {
        md += `- ${service}\n`;
      }
    }
    if (comp.considerations?.length > 0) {
      md += `\n**Implementation Considerations:**\n`;
      for (const c of comp.considerations) {
        md += `- ${c}\n`;
      }
    }
    md += '\n';
  }

  md += `## Data Flow\n`;
  for (const step of data.dataFlow) {
    md += `${step}\n`;
  }
  md += '\n';

  md += `## Security Considerations\n`;
  for (const c of data.securityConsiderations) {
    md += `- ${c}\n`;
  }
  md += '\n';

  if (data.scalingConsiderations?.length > 0) {
    md += `## Scaling Considerations\n`;
    for (const c of data.scalingConsiderations) {
      md += `- ${c}\n`;
    }
  }

  return md;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatComplianceMarkdown(data: any, industry: string, dataTypes: string[]): string {
  let md = `# Compliance Assessment\n\n`;
  md += `**Industry:** ${industry}\n`;
  md += `**Data Types:** ${dataTypes.length > 0 ? dataTypes.join(', ') : 'Not specified'}\n\n`;

  md += `## Applicable Frameworks\n\n`;
  for (const fw of data.applicableFrameworks) {
    const icon = fw.priority === 'required' ? '🔴' : '🟡';
    md += `### ${icon} ${fw.name}\n`;
    md += `**Priority:** ${fw.priority}\n`;
    md += `**Reason:** ${fw.applicabilityReason}\n\n`;
  }

  if (data.keyRequirements?.length > 0) {
    md += `## Key Requirements\n\n`;
    for (const req of data.keyRequirements) {
      md += `### ${req.category}\n`;
      md += `**Requirement:** ${req.requirement}\n`;
      md += `**Implementation:** ${req.implementation}\n`;
      md += `**Priority:** ${req.priority}\n\n`;
    }
  }

  md += `## Risk Areas\n\n`;
  for (const risk of data.riskAreas) {
    md += `### ⚠️ ${risk.area}\n`;
    md += `**Risk:** ${risk.risk}\n`;
    md += `**Mitigation:** ${risk.mitigation}\n\n`;
  }

  if (data.checklist) {
    md += `## Implementation Checklist\n\n`;
    for (const item of data.checklist) {
      md += `- [ ] **${item.category}:** ${item.item}\n`;
    }
  }

  return md;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatPlanMarkdown(data: any, patternName: string): string {
  let md = `# Implementation Plan\n\n`;
  md += `## Summary\n`;
  md += `- **Total Duration:** ${data.summary.totalWeeks} weeks (${data.summary.totalSprints} sprints)\n`;
  md += `- **Team Size:** ${data.summary.teamSize}\n`;
  md += `- **Architecture Pattern:** ${patternName}\n\n`;

  md += `## Phases\n\n`;
  for (const phase of data.phases) {
    md += `### ${phase.name}\n`;
    md += `${phase.description}\n\n`;
    md += `**Duration:** ${phase.durationWeeks} weeks | **Sprints:** ${phase.sprints.length}\n\n`;

    md += `**Milestones:**\n`;
    for (const m of phase.milestones) {
      md += `- ✓ ${m}\n`;
    }
    md += '\n';

    md += `**Risk Factors:**\n`;
    for (const r of phase.riskFactors) {
      md += `- ⚠️ ${r}\n`;
    }
    md += '\n';
  }

  md += `## Skill Requirements\n\n`;
  for (const skill of data.skillRequirements) {
    const icon = skill.level === 'required' ? '🔴' : '🟡';
    md += `- ${icon} **${skill.skill}** (${skill.level})\n`;
    md += `  - Roles: ${skill.roles.join(', ')}\n`;
  }
  md += '\n';

  if (data.jiraTickets) {
    md += `## Jira Ticket Templates\n\n`;
    for (const ticket of data.jiraTickets) {
      md += `### [${ticket.type.toUpperCase()}] ${ticket.summary}\n`;
      md += `${ticket.description}\n`;
      md += `- **Labels:** ${ticket.labels.join(', ')}\n`;
      if (ticket.estimateHours) {
        md += `- **Estimate:** ${ticket.estimateHours} hours\n`;
      }
      md += '\n';
    }
  }

  return md;
}

export default function Home() {
  const [selectedIndustry, setSelectedIndustry] = useState<'healthcare' | 'financial' | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent>({});
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Store intermediate data for chaining API calls
  const [contextData, setContextData] = useState<ProjectContextData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [architectureData, setArchitectureData] = useState<any>(null);

  const projectKey = selectedIndustry === 'healthcare' ? 'HEALTH' : 'FINSERV';

  const streamText = useCallback(async (text: string): Promise<void> => {
    for (let i = 0; i < text.length; i += 3) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      setStreamingText(text.substring(0, i + 3));
    }
  }, []);

  const generateStep = useCallback(async (step: Step) => {
    setIsGenerating(true);
    setStreamingText('');
    setError(null);

    try {
      let markdown = '';

      if (step === 'context') {
        const res = await fetch('/api/tools/read-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectKey, includeIssues: true, issueLimit: 10 }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data: ProjectContextData = await res.json();
        setContextData(data);
        markdown = formatContextMarkdown(data);

      } else if (step === 'architecture') {
        const useCaseDesc = contextData?.project.description || 'AI-powered enterprise application';
        const complianceTags = contextData?.allLabels.filter(l =>
          ['hipaa', 'soc2', 'fedramp', 'pci_dss', 'gdpr', 'ccpa'].includes(l)
        ) || [];
        const industry = selectedIndustry === 'healthcare' ? 'healthcare' : 'financial_services';

        const res = await fetch('/api/tools/generate-architecture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectContext: {
              projectKey,
              industry,
              useCaseDescription: useCaseDesc,
              complianceTags,
              cloudProvider: 'aws',
              dataTypes: contextData?.detectedDataTypes || [],
              integrationTargets: contextData?.detectedIntegrations || [],
            },
            includeDiagram: true,
            includeAlternatives: true,
          }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setArchitectureData(data);
        markdown = formatArchitectureMarkdown(data);

      } else if (step === 'compliance') {
        const industry = selectedIndustry === 'healthcare' ? 'healthcare' : 'financial_services';
        const complianceTags = contextData?.allLabels.filter(l =>
          ['hipaa', 'soc2', 'fedramp', 'pci_dss', 'gdpr', 'ccpa'].includes(l)
        ) || [];

        const res = await fetch('/api/tools/assess-compliance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectContext: {
              projectKey,
              industry,
              useCaseDescription: contextData?.project.description || '',
              complianceTags,
              cloudProvider: 'aws',
              dataTypes: contextData?.detectedDataTypes || [],
              integrationTargets: contextData?.detectedIntegrations || [],
            },
            detailLevel: 'detailed',
            includeChecklist: true,
          }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        markdown = formatComplianceMarkdown(
          data,
          industry,
          contextData?.detectedDataTypes || []
        );

      } else if (step === 'plan') {
        const industry = selectedIndustry === 'healthcare' ? 'healthcare' : 'financial_services';
        const complianceTags = contextData?.allLabels.filter(l =>
          ['hipaa', 'soc2', 'fedramp', 'pci_dss', 'gdpr', 'ccpa'].includes(l)
        ) || [];

        const res = await fetch('/api/tools/create-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectContext: {
              projectKey,
              industry,
              useCaseDescription: contextData?.project.description || '',
              complianceTags,
              cloudProvider: 'aws',
              dataTypes: contextData?.detectedDataTypes || [],
              integrationTargets: contextData?.detectedIntegrations || [],
            },
            architecturePattern: architectureData?.pattern || 'conversational_agent',
            teamSize: 5,
            sprintLengthWeeks: 2,
            includeJiraTickets: true,
          }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        markdown = formatPlanMarkdown(
          data,
          architectureData?.patternName || architectureData?.pattern || 'Unknown'
        );
      }

      await streamText(markdown);
      setGeneratedContent((prev) => ({ ...prev, [step]: markdown }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setIsGenerating(false);
      setStreamingText('');
    }
  }, [projectKey, contextData, architectureData, selectedIndustry, streamText]);

  const handleSelectIndustry = (industry: 'healthcare' | 'financial') => {
    setSelectedIndustry(industry);
    setCurrentStep('context');
    setGeneratedContent({});
    setContextData(null);
    setArchitectureData(null);
    setError(null);
  };

  const handleNextStep = async () => {
    const steps: Step[] = ['select', 'context', 'architecture', 'compliance', 'plan', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];

    if (nextStep && nextStep !== 'complete') {
      await generateStep(nextStep);
    }

    setCurrentStep(nextStep);
  };

  const handleRunAll = async () => {
    const steps: Step[] = ['context', 'architecture', 'compliance', 'plan'];

    for (const step of steps) {
      setCurrentStep(step);
      await generateStep(step);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setCurrentStep('complete');
  };

  // For the initial context view, fetch issues from the API on first render
  const contextIssues = contextData?.issues || [];

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <FileCode className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Partner Enablement Demo</h1>
                <p className="text-sm text-gray-500">GSI Architecture Generator powered by Claude</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/egaile"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://linkedin.com/in/edgaile"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      {selectedIndustry && (
        <div className="border-b bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              {['context', 'architecture', 'compliance', 'plan'].map((step, index) => {
                const stepLabels: Record<string, string> = {
                  context: 'Project Context',
                  architecture: 'Architecture',
                  compliance: 'Compliance',
                  plan: 'Implementation',
                };
                const isActive = currentStep === step;
                const isComplete = generatedContent[step as keyof GeneratedContent];

                return (
                  <div key={step} className="flex items-center">
                    <div
                      className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                        isActive
                          ? 'bg-amber-100 text-amber-800'
                          : isComplete
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {isComplete && !isActive ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                      )}
                      <span className="text-sm font-medium">{stepLabels[step]}</span>
                    </div>
                    {index < 3 && <ChevronRight className="w-5 h-5 text-gray-300 mx-2" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentStep === 'select' && (
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Generate Compliant Reference Architectures
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              See how Claude can help GSIs translate project requirements into deployment-ready
              architectures with compliance guidance and implementation plans.
            </p>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <button
                onClick={() => handleSelectIndustry('healthcare')}
                className="card-hover bg-white rounded-xl border border-gray-200 p-8 text-left"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Healthcare</h3>
                <p className="text-gray-600 mb-4">
                  Patient intake assistant with EHR integration. Includes HIPAA compliance guidance.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">HIPAA</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Epic EHR</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">FHIR</span>
                </div>
              </button>

              <button
                onClick={() => handleSelectIndustry('financial')}
                className="card-hover bg-white rounded-xl border border-gray-200 p-8 text-left opacity-50 cursor-not-allowed"
                disabled
              >
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Financial Services</h3>
                <p className="text-gray-600 mb-4">
                  Document processing and customer service automation. Coming soon.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">SOC2</span>
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">PCI-DSS</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {currentStep === 'context' && !generatedContent.context && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileCode className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Jira Project: {projectKey}</h3>
                    <p className="text-sm text-gray-500">
                      {selectedIndustry === 'healthcare' ? 'Healthcare AI Assistant' : 'Financial Services'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {process.env.NEXT_PUBLIC_JIRA_CONFIGURED === 'true' ? 'Live Jira Data' : 'Demo Data'}
                </span>
              </div>

              <div className="p-6">
                <p className="text-gray-600 mb-6">
                  {selectedIndustry === 'healthcare'
                    ? 'AI-powered patient intake and benefits navigation system for regional health network'
                    : 'Document processing and customer service automation for regional bank'}
                </p>

                {contextIssues.length > 0 && (
                  <>
                    <h4 className="font-medium text-gray-900 mb-3">Recent Issues</h4>
                    <div className="space-y-3">
                      {contextIssues.map((issue) => (
                        <div key={issue.key} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <span className="text-sm font-medium text-blue-600">{issue.key}</span>
                              <h5 className="font-medium text-gray-900">{issue.summary}</h5>
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                issue.priority === 'Critical'
                                  ? 'bg-red-100 text-red-700'
                                  : issue.priority === 'High'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {issue.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{issue.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {issue.labels.map((label) => (
                              <span
                                key={label}
                                className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t flex justify-between">
                <button
                  onClick={() => {
                    setSelectedIndustry(null);
                    setCurrentStep('select');
                    setGeneratedContent({});
                    setContextData(null);
                    setArchitectureData(null);
                  }}
                  className="text-gray-600 hover:text-gray-900"
                >
                  &larr; Back to selection
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleRunAll}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    Run Full Demo
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                  >
                    Generate Context
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="max-w-4xl mx-auto mb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              Error: {error}
            </div>
          </div>
        )}

        {/* Generated Content Display */}
        {(generatedContent[currentStep as keyof GeneratedContent] || streamingText) &&
          currentStep !== 'complete' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {currentStep === 'context' && <FileCode className="w-5 h-5 text-blue-600" />}
                    {currentStep === 'architecture' && (
                      <Building2 className="w-5 h-5 text-purple-600" />
                    )}
                    {currentStep === 'compliance' && <Shield className="w-5 h-5 text-red-600" />}
                    {currentStep === 'plan' && (
                      <ClipboardList className="w-5 h-5 text-green-600" />
                    )}
                    <h3 className="font-medium text-gray-900">
                      {currentStep === 'context' && 'Project Context'}
                      {currentStep === 'architecture' && 'Reference Architecture'}
                      {currentStep === 'compliance' && 'Compliance Assessment'}
                      {currentStep === 'plan' && 'Implementation Plan'}
                    </h3>
                  </div>
                  {isGenerating && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Generating...</span>
                    </div>
                  )}
                </div>

                <div className="p-6 prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded-lg overflow-auto max-h-[600px]">
                    {streamingText || generatedContent[currentStep as keyof GeneratedContent]}
                  </pre>
                </div>

                {!isGenerating && (
                  <div className="bg-gray-50 px-6 py-4 border-t flex justify-end">
                    {currentStep !== 'plan' ? (
                      <button
                        onClick={handleNextStep}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                      >
                        Next Step
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentStep('complete')}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Complete Demo
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Completion State */}
        {currentStep === 'complete' && (
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-white rounded-xl border border-gray-200 p-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Demo Complete!</h2>
              <p className="text-gray-600 mb-8 max-w-lg mx-auto">
                This demonstration shows how an MCP server can help GSI partners accelerate Claude
                deployments by automatically generating compliant reference architectures from
                project requirements.
              </p>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Context Extraction</h4>
                  <p className="text-sm text-gray-500">Read project requirements from Jira</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Architecture Generation</h4>
                  <p className="text-sm text-gray-500">Pattern-matched reference architecture</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Compliance & Planning</h4>
                  <p className="text-sm text-gray-500">Implementation-ready deliverables</p>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => {
                    setSelectedIndustry(null);
                    setCurrentStep('select');
                    setGeneratedContent({});
                    setContextData(null);
                    setArchitectureData(null);
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Try Another Vertical
                </button>
                <a
                  href="https://github.com/egaile/partner-enablement-mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  <Github className="w-4 h-4" />
                  View on GitHub
                </a>
              </div>
            </div>

            {/* About Section */}
            <div className="mt-12 text-left bg-white rounded-xl border border-gray-200 p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">About This Project</h3>
              <p className="text-gray-600 mb-6">
                This demonstration was built to show how Anthropic&apos;s partner team could help Global
                System Integrators operationalize Claude deployments faster. The MCP server
                architecture enables Claude to read project context from enterprise tools (like Jira)
                and generate compliant, deployment-ready artifacts.
              </p>

              <div className="flex items-center gap-4 pt-4 border-t">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center text-white font-semibold">
                  EG
                </div>
                <div>
                  <p className="font-medium text-gray-900">Ed Gaile</p>
                  <p className="text-sm text-gray-500">Principal Solutions Architect</p>
                </div>
                <div className="ml-auto flex gap-3">
                  <a
                    href="https://linkedin.com/in/edgaile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://github.com/egaile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    <Github className="w-4 h-4" />
                    GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
