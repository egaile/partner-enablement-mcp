import { Play, Zap, Layers, Clock } from 'lucide-react';
import { Card } from './ui/Card';
import { HERO_COPY, EXPLAINER_CARDS, LIVE_INTEGRATION_COPY, SCENARIOS, TAG_COLORS } from '@/lib/constants';
import type { Industry } from '@/types/api';

interface HeroLandingProps {
  onSelectIndustry: (industry: Industry) => void;
}

export function HeroLanding({ onSelectIndustry }: HeroLandingProps) {
  const explainerIcons = [
    <Zap key="zap" className="w-5 h-5 text-claude-orange" />,
    <Layers key="layers" className="w-5 h-5 text-claude-orange" />,
    <Clock key="clock" className="w-5 h-5 text-claude-orange" />,
  ];

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

      {/* Live Integration Notice */}
      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-8">
        <span className="relative flex h-2 w-2 mt-1 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <p className="text-sm text-green-800">{LIVE_INTEGRATION_COPY}</p>
      </div>

      {/* Scenario Cards */}
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Client Scenario</h3>
      <div className="grid md:grid-cols-2 gap-5">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.industry}
            onClick={() => onSelectIndustry(scenario.industry)}
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
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                  {scenario.projectKey}
                </span>
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
  );
}
