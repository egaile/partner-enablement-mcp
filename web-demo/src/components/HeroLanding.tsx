'use client';

import { useState } from 'react';
import { Play, Zap, Layers, Clock, ChevronLeft, Wrench, BookOpen, Users, Shield, Settings, Radar, ShieldAlert } from 'lucide-react';
import { Card } from './ui/Card';
import { ArchitectureDiagram } from './ArchitectureDiagram';
import { HERO_COPY, EXPLAINER_CARDS, LIVE_INTEGRATION_COPY, SCENARIOS, TAG_COLORS, WORKFLOWS } from '@/lib/constants';
import type { Industry, WorkflowId, FeatureId } from '@/types/api';

interface HeroLandingProps {
  onStart: (workflow: WorkflowId, industry: Industry) => void;
  onSelectFeature?: (feature: FeatureId) => void;
  onStartRiskRadar?: () => void;
}

const WORKFLOW_ICONS: Record<string, React.ReactNode> = {
  'deployment-planning': <Wrench className="w-5 h-5" />,
  'knowledge-audit': <BookOpen className="w-5 h-5" />,
  'sprint-operations': <Users className="w-5 h-5" />,
  'risk-radar': <Radar className="w-5 h-5" />,
};

interface FeatureConfig {
  id: FeatureId;
  name: string;
  description: string;
  persona: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
}

const SECURITY_FEATURES: FeatureConfig[] = [
  {
    id: 'threat-simulator',
    name: 'Security Threat Simulator',
    description: 'Interactive red team playground — craft injection attacks and watch the gateway\'s 5-scanner pipeline catch them in real time.',
    persona: 'CISO',
    icon: <ShieldAlert className="w-5 h-5" />,
    color: 'red',
    features: ['5 scanner strategies', '8 attack scenarios', 'PII detection', 'Real-time blocking'],
  },
  {
    id: 'governance',
    name: 'Governance Control Room',
    description: 'Toggle 6 Atlassian policy templates and watch tool calls get allowed, blocked, or routed to human approval.',
    persona: 'VP Engineering',
    icon: <Settings className="w-5 h-5" />,
    color: 'blue',
    features: ['6 policy templates', 'HITL approval flow', 'PII redaction demo', 'Client-side evaluation'],
  },
];

const FEATURE_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  red: { bg: 'bg-red-50/50', text: 'text-red-600', border: 'border-red-400', badge: 'bg-red-100 text-red-700' },
  blue: { bg: 'bg-blue-50/50', text: 'text-blue-600', border: 'border-blue-400', badge: 'bg-blue-100 text-blue-700' },
};

// Separate the first 3 workflows (step-based with scenario selection) from risk-radar
const STEP_WORKFLOWS = WORKFLOWS.filter((w) => w.selectorType !== 'none');
const RISK_RADAR_WORKFLOW = WORKFLOWS.find((w) => w.id === 'risk-radar');

export function HeroLanding({ onStart, onSelectFeature, onStartRiskRadar }: HeroLandingProps) {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowId | null>(null);

  const explainerIcons = [
    <Zap key="zap" className="w-5 h-5 text-claude-orange" />,
    <Layers key="layers" className="w-5 h-5 text-claude-orange" />,
    <Clock key="clock" className="w-5 h-5 text-claude-orange" />,
  ];

  const activeWorkflow = selectedWorkflow
    ? WORKFLOWS.find((w) => w.id === selectedWorkflow)
    : null;

  return (
    <div className="animate-fade-in">
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-anthropic-900 via-anthropic-800 to-anthropic-900 rounded-2xl p-8 sm:p-12 mb-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(217,119,6,0.08),transparent_60%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-amber-200 mb-5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
            Live Demo
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 leading-tight max-w-3xl">
            {HERO_COPY.headline}
          </h2>
          <p className="text-base sm:text-lg text-gray-300 max-w-2xl leading-relaxed">
            {HERO_COPY.subheadline}
          </p>
        </div>
      </div>

      {/* Explainer Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {EXPLAINER_CARDS.map((card, i) => (
          <Card key={card.title} className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              {explainerIcons[i]}
              <h3 className="font-semibold text-gray-900 text-sm">{card.title}</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed flex-1">{card.body}</p>
          </Card>
        ))}
      </div>

      {/* Architecture Diagram */}
      <ArchitectureDiagram />

      {/* Spacer */}
      <div className="h-8" />

      {/* Live Integration Notice */}
      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-8">
        <span className="relative flex h-2 w-2 mt-1 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <p className="text-sm text-green-800">{LIVE_INTEGRATION_COPY}</p>
      </div>

      {/* ======= Enterprise Workflows Section ======= */}
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Enterprise Workflows</h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {STEP_WORKFLOWS.map((workflow) => {
          const isSelected = selectedWorkflow === workflow.id;
          return (
            <button
              key={workflow.id}
              onClick={() => setSelectedWorkflow(isSelected ? null : workflow.id)}
              className={`group text-left rounded-xl border p-5 transition-all duration-200 ${
                isSelected
                  ? 'border-claude-orange bg-orange-50/50 shadow-md shadow-orange-500/10'
                  : 'border-gray-200 bg-white hover:border-claude-orange/40 hover:shadow-lg hover:shadow-orange-500/5'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-claude-orange/10 text-claude-orange' : 'bg-gray-100 text-gray-500 group-hover:text-claude-orange'}`}>
                  {WORKFLOW_ICONS[workflow.id]}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isSelected ? 'bg-claude-orange/10 text-claude-orange' : 'bg-gray-100 text-gray-500'
                }`}>
                  {workflow.persona}
                </span>
              </div>
              <h4 className={`font-semibold mb-1 transition-colors ${isSelected ? 'text-claude-orange' : 'text-gray-900 group-hover:text-claude-orange'}`}>
                {workflow.name}
              </h4>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">
                {workflow.description}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">{workflow.steps.length} steps</span>
                <span className="text-gray-300">&middot;</span>
                <span className="text-gray-400">{workflow.toolCount} tools</span>
                <span className="text-gray-300">&middot;</span>
                <span className="text-gray-400 capitalize">
                  {workflow.selectorType === 'jira-project' ? 'Jira' : 'Confluence'}
                </span>
              </div>
            </button>
          );
        })}
        {/* Risk Radar — launches directly without scenario selection */}
        {RISK_RADAR_WORKFLOW && (
          <button
            onClick={() => onStartRiskRadar?.()}
            className="group text-left rounded-xl border border-gray-200 bg-white p-5 hover:border-purple-400/40 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-200"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-gray-100 text-gray-500 group-hover:text-purple-600">
                <Radar className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {RISK_RADAR_WORKFLOW.persona}
              </span>
            </div>
            <h4 className="font-semibold mb-1 transition-colors text-gray-900 group-hover:text-purple-600">
              {RISK_RADAR_WORKFLOW.name}
            </h4>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">
              {RISK_RADAR_WORKFLOW.description}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">{RISK_RADAR_WORKFLOW.steps.length} steps</span>
              <span className="text-gray-300">&middot;</span>
              <span className="text-gray-400">{RISK_RADAR_WORKFLOW.toolCount} tools</span>
              <span className="text-gray-300">&middot;</span>
              <span className="text-gray-400">All Projects</span>
            </div>
          </button>
        )}
      </div>

      {/* Scenario Cards — shown when a step-based workflow is selected */}
      {activeWorkflow && activeWorkflow.selectorType !== 'none' && (
        <div className="animate-fade-in mb-10">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setSelectedWorkflow(null)}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-semibold text-gray-900">
              Select a Client Scenario
            </h3>
            <span className="text-sm text-gray-400">
              for {activeWorkflow.name}
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.industry}
                onClick={() => onStart(activeWorkflow.id, scenario.industry)}
                className="group text-left bg-white rounded-xl border border-gray-200 p-6 hover:border-claude-orange/40 hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-200"
              >
                <h4 className="font-semibold text-gray-900 mb-2 group-hover:text-claude-orange transition-colors">
                  {scenario.title}
                </h4>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  {scenario.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {activeWorkflow.selectorType === 'jira-project' ? (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                        {scenario.projectKey}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                        Space: {scenario.spaceKey}
                      </span>
                    )}
                    {scenario.tags.map((tag) => (
                      <span
                        key={tag.label}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[tag.color] || TAG_COLORS.gray}`}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                  <Play className="w-4 h-4 text-gray-300 group-hover:text-claude-orange transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ======= Security & Governance Section ======= */}
      <div className="border-t border-gray-200 pt-8 mt-2">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">Security & Governance</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            Interactive
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-5 max-w-2xl">
          Explore the gateway&apos;s security capabilities hands-on. No Atlassian connection needed — these features run entirely in your browser.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          {SECURITY_FEATURES.map((feature) => {
            const colors = FEATURE_COLORS[feature.color];
            return (
              <button
                key={feature.id}
                onClick={() => onSelectFeature?.(feature.id)}
                className={`group text-left rounded-xl border border-gray-200 bg-white p-6 hover:${colors.border} hover:shadow-lg transition-all duration-200`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg bg-gray-100 ${colors.text} group-hover:bg-opacity-50`}>
                    {feature.icon}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                    {feature.persona}
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
                  {feature.name}
                </h4>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  {feature.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {feature.features.map((f) => (
                    <span key={f} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {f}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
