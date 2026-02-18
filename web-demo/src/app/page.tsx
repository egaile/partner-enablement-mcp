'use client';

import { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';

// Mock project data (simulating Jira)
const mockProjects = {
  healthcare: {
    key: 'HEALTH',
    name: 'Healthcare AI Assistant',
    description: 'AI-powered patient intake and benefits navigation system for regional health network',
    issues: [
      {
        key: 'HEALTH-1',
        summary: 'Patient Intake Conversational Flow',
        description: 'Design and implement conversational AI flow for gathering patient information before appointments. Must integrate with Epic EHR via FHIR APIs.',
        labels: ['hipaa', 'phi', 'patient-facing', 'epic-integration'],
        type: 'Epic',
        priority: 'High'
      },
      {
        key: 'HEALTH-2',
        summary: 'Benefits Navigator RAG System',
        description: 'Implement retrieval-augmented generation system to answer patient questions about their insurance benefits.',
        labels: ['hipaa', 'rag', 'patient-facing', 'benefits'],
        type: 'Epic',
        priority: 'Medium'
      },
      {
        key: 'HEALTH-3',
        summary: 'HIPAA Compliance Infrastructure',
        description: 'Set up compliant infrastructure including encryption, audit logging, access controls, BAA with Claude API provider.',
        labels: ['hipaa', 'infrastructure', 'security', 'compliance'],
        type: 'Epic',
        priority: 'Critical'
      }
    ]
  },
  financial: {
    key: 'FINSERV',
    name: 'Financial Document Processing',
    description: 'Intelligent document processing and customer service automation for regional bank',
    issues: [
      {
        key: 'FINSERV-1',
        summary: 'Document Classification Pipeline',
        description: 'Build automated pipeline for classifying incoming financial documents.',
        labels: ['soc2', 'batch-processing', 'documents'],
        type: 'Epic',
        priority: 'High'
      }
    ]
  }
};

type Step = 'select' | 'context' | 'architecture' | 'compliance' | 'plan' | 'complete';

interface GeneratedContent {
  context?: string;
  architecture?: string;
  compliance?: string;
  plan?: string;
}

export default function Home() {
  const [selectedIndustry, setSelectedIndustry] = useState<'healthcare' | 'financial' | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent>({});
  const [streamingText, setStreamingText] = useState('');

  const project = selectedIndustry ? mockProjects[selectedIndustry] : null;

  const simulateGeneration = async (step: Step) => {
    setIsGenerating(true);
    setStreamingText('');
    
    // Simulate streaming response
    const content = getContentForStep(step);
    for (let i = 0; i < content.length; i += 3) {
      await new Promise(resolve => setTimeout(resolve, 10));
      setStreamingText(content.substring(0, i + 3));
    }
    
    setGeneratedContent(prev => ({ ...prev, [step]: content }));
    setIsGenerating(false);
    setStreamingText('');
  };

  const getContentForStep = (step: Step): string => {
    switch (step) {
      case 'context':
        return `# Project Context: ${project?.name}

**Key:** ${project?.key}
**Industry:** Healthcare

## Compliance Indicators
- ⚠️ HIPAA compliance required (PHI handling detected)
- ⚠️ BAA required with LLM provider

## Detected Integration Targets
- Epic EHR (FHIR APIs)
- Benefits eligibility systems

## Recent Issues (${project?.issues.length})

${project?.issues.map(issue => `### ${issue.key}: ${issue.summary}
**Type:** ${issue.type} | **Priority:** ${issue.priority}
**Labels:** ${issue.labels.join(', ')}

${issue.description}
`).join('\n')}`;

      case 'architecture':
        return `# Reference Architecture: Conversational Agent with Tool Use

## Pattern Selection
**Recommended Pattern:** Conversational Agent with Tool Use

**Rationale:** Based on the use case "AI-powered patient intake and benefits navigation", this pattern is recommended because it supports multi-turn interactions with personalized, context-aware responses and integration with external systems (Epic EHR).

## Architecture Diagram

\`\`\`mermaid
graph TB
    User[Patient] --> API[API Gateway]
    API --> Orch[Orchestration Layer]
    Orch --> Session[(Session Store)]
    Orch --> Claude[Claude API]
    Claude --> |Tool Call| Tools[Tool Execution]
    Tools --> |Tool Result| Claude
    Claude --> Orch
    Orch --> Session
    Orch --> API
    API --> User
    
    subgraph External Systems
        Tools --> EHR[Epic EHR - FHIR]
        Tools --> Benefits[Benefits API]
    end
    
    subgraph Compliance Layer
        Audit[(Audit Logs)]
        Orch --> Audit
        Tools --> Audit
    end
\`\`\`

## Components

### Conversation Management
Manages session state and conversation history with HIPAA-compliant storage.

**AWS Services:**
- DynamoDB (encrypted at rest)
- ElastiCache Redis (in-VPC)

**Implementation Considerations:**
- AES-256 encryption for all PHI storage
- Session timeout (15-30 minutes)
- Automatic session cleanup

### Orchestration Layer
Handles conversation flow and tool execution with audit logging.

**AWS Services:**
- ECS/Fargate (HIPAA-eligible)
- Lambda for tool execution

### LLM Integration
Claude API with tool use for EHR and benefits queries.

**Anthropic Services:**
- Claude API with BAA
- Tool use for structured data retrieval

## Security Considerations
- BAA required with Claude API provider
- PHI must be encrypted at rest and in transit
- Comprehensive audit logging required for all PHI access
- Tool execution permissions and scoping
- Session token management and expiration
- Input validation before tool execution`;

      case 'compliance':
        return `# Compliance Assessment

**Industry:** Healthcare
**Data Types:** PHI, PII

## Applicable Frameworks

### 🔴 HIPAA
**Priority:** Required
**Reason:** Processing Protected Health Information (PHI)

### 🟡 SOC 2
**Priority:** Recommended
**Reason:** SaaS deployment handling sensitive data

## Key Requirements

### Data at Rest
**Requirement:** Encryption required (addressable but strongly recommended)
**Implementation:** AES-256 encryption for all PHI storage; AWS KMS for key management
**Priority:** Critical

### Data in Transit
**Requirement:** Encryption required
**Implementation:** TLS 1.2+ for all data transmission; No PHI in URLs
**Priority:** Critical

### LLM Specific
**Requirement:** Special considerations for AI/LLM deployments
**Implementation:** BAA required with Anthropic; PHI handling procedures; Human-in-the-loop for clinical decisions
**Priority:** Critical

## Risk Areas

### ⚠️ PHI in LLM Prompts
**Risk:** Protected Health Information may be included in prompts sent to Claude API
**Mitigation:** Ensure BAA is in place with Anthropic; implement PHI detection and masking where appropriate

### ⚠️ Conversation Logging
**Risk:** Chat logs containing PHI require same protections as other PHI
**Mitigation:** Encrypt conversation storage; implement access controls; define retention policies

### ⚠️ EHR Integration
**Risk:** Integration with EHR systems expands attack surface and compliance scope
**Mitigation:** Follow Epic security guidelines; implement API access controls; audit all data access

## Implementation Checklist

- [ ] **Legal:** BAA executed with Anthropic
- [ ] **Technical:** Data encryption at rest configured
- [ ] **Technical:** Data encryption in transit (TLS 1.2+)
- [ ] **Technical:** Audit logging implemented
- [ ] **Technical:** Access controls and RBAC configured
- [ ] **Administrative:** Security risk assessment completed
- [ ] **Administrative:** Incident response plan documented
- [ ] **Administrative:** Staff training completed`;

      case 'plan':
        return `# Implementation Plan

## Summary
- **Total Duration:** 16 weeks (8 sprints)
- **Team Size:** 5
- **Sprint Length:** 2 weeks
- **Architecture Pattern:** Conversational Agent with Tool Use

## Phases

### Phase 1: Discovery & Design (3 weeks)
Requirements gathering, architecture design, compliance planning

**Milestones:**
- ✓ Architecture design approved
- ✓ Compliance requirements documented
- ✓ Development environment setup

**Risk Factors:**
- ⚠️ Stakeholder availability for requirements
- ⚠️ Epic API access and credentials

### Phase 2: Foundation & Infrastructure (4 weeks)
Core infrastructure, security controls, CI/CD pipeline

**Milestones:**
- ✓ AWS infrastructure deployed
- ✓ Security controls implemented
- ✓ CI/CD pipeline operational

### Phase 3: Core Development (6 weeks)
Primary feature development, integrations, LLM implementation

**Milestones:**
- ✓ Core conversation flow functional
- ✓ Claude API integration complete
- ✓ Epic FHIR integration working

### Phase 4: Testing & Hardening (3 weeks)
Comprehensive testing, security audit, performance optimization

**Milestones:**
- ✓ UAT complete
- ✓ Security audit passed
- ✓ HIPAA compliance verified

## Jira Ticket Templates

### [EPIC] Infrastructure & Security Foundation
Set up AWS infrastructure with HIPAA-compliant security controls
- **Labels:** infrastructure, security, hipaa
- **Estimate:** 80 hours

### [EPIC] Claude Integration & Conversation Flow
Implement conversational agent with Claude API and tool use
- **Labels:** development, llm, core
- **Estimate:** 160 hours

### [EPIC] Epic EHR Integration
Build FHIR-based integration with Epic EHR
- **Labels:** integration, ehr, fhir
- **Estimate:** 80 hours

### [STORY] Execute BAA with Anthropic
Coordinate with legal to execute Business Associate Agreement
- **Labels:** compliance, legal
- **Estimate:** 4 hours`;

      default:
        return '';
    }
  };

  const handleSelectIndustry = (industry: 'healthcare' | 'financial') => {
    setSelectedIndustry(industry);
    setCurrentStep('context');
    setGeneratedContent({});
  };

  const handleNextStep = async () => {
    const steps: Step[] = ['select', 'context', 'architecture', 'compliance', 'plan', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];
    
    if (nextStep && nextStep !== 'complete') {
      await simulateGeneration(nextStep);
    }
    
    setCurrentStep(nextStep);
  };

  const handleRunAll = async () => {
    const steps: Step[] = ['context', 'architecture', 'compliance', 'plan'];
    
    for (const step of steps) {
      setCurrentStep(step);
      await simulateGeneration(step);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setCurrentStep('complete');
  };

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
                  plan: 'Implementation'
                };
                const isActive = currentStep === step;
                const isComplete = generatedContent[step as keyof GeneratedContent];
                
                return (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                      isActive ? 'bg-amber-100 text-amber-800' :
                      isComplete ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {isComplete && !isActive ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                      )}
                      <span className="text-sm font-medium">{stepLabels[step]}</span>
                    </div>
                    {index < 3 && (
                      <ChevronRight className="w-5 h-5 text-gray-300 mx-2" />
                    )}
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
                    <h3 className="font-medium text-gray-900">Jira Project: {project?.key}</h3>
                    <p className="text-sm text-gray-500">{project?.name}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">Simulated Jira Data</span>
              </div>
              
              <div className="p-6">
                <p className="text-gray-600 mb-6">{project?.description}</p>
                
                <h4 className="font-medium text-gray-900 mb-3">Recent Issues</h4>
                <div className="space-y-3">
                  {project?.issues.map(issue => (
                    <div key={issue.key} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-sm font-medium text-blue-600">{issue.key}</span>
                          <h5 className="font-medium text-gray-900">{issue.summary}</h5>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          issue.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                          issue.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {issue.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{issue.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {issue.labels.map(label => (
                          <span key={label} className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-gray-50 px-6 py-4 border-t flex justify-between">
                <button
                  onClick={() => {
                    setSelectedIndustry(null);
                    setCurrentStep('select');
                    setGeneratedContent({});
                  }}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← Back to selection
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

        {/* Generated Content Display */}
        {(generatedContent[currentStep as keyof GeneratedContent] || streamingText) && currentStep !== 'complete' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {currentStep === 'context' && <FileCode className="w-5 h-5 text-blue-600" />}
                  {currentStep === 'architecture' && <Building2 className="w-5 h-5 text-purple-600" />}
                  {currentStep === 'compliance' && <Shield className="w-5 h-5 text-red-600" />}
                  {currentStep === 'plan' && <ClipboardList className="w-5 h-5 text-green-600" />}
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
                This demonstration shows how an MCP server can help GSI partners accelerate 
                Claude deployments by automatically generating compliant reference architectures 
                from project requirements.
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
                This demonstration was built to show how Anthropic's partner team could help Global System 
                Integrators operationalize Claude deployments faster. The MCP server architecture enables 
                Claude to read project context from enterprise tools (like Jira) and generate compliant, 
                deployment-ready artifacts.
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
