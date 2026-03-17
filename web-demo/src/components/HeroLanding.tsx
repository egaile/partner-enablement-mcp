'use client';

import { useState } from 'react';
import { Play, Zap, Layers, Clock, ChevronLeft, Wrench, BookOpen, Users } from 'lucide-react';
import { Card } from './ui/Card';
import { ArchitectureDiagram } from './ArchitectureDiagram';
import { HERO_COPY, EXPLAINER_CARDS, LIVE_INTEGRATION_COPY, SCENARIOS, TAG_COLORS, WORKFLOWS } from '@/lib/constants';
import type { Industry, WorkflowId } from '@/types/api';

interface HeroLandingProps {
  onStart: (workflow: WorkflowId, industry: Industry) => void;
}

const WORKFLOW_ICONS: Record<WorkflowId, React.ReactNode> = {
  'deployment-planning': <Wrench className="w-5 h-5" />,
  'knowledge-audit': <BookOpen className="w-5 h-5" />,
  'sprint-operations': <Users className="w-5 h-5" />,
};

export function HeroLanding({ onStart }: HeroLandingProps) {
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

      {/* Workflow Selector */}
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose a Workflow</h3>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {WORKFLOWS.map((workflow) => {
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
      </div>

      {/* Scenario Cards — shown when workflow is selected */}
      {activeWorkflow && (
        <div className="animate-fade-in">
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
    </div>
  );
}
