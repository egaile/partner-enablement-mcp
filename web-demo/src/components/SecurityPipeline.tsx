'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  FileCheck,
  Scan,
  Fingerprint,
  Send,
  Eye,
  BookOpen,
  ChevronDown,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { TOOL_NARRATIVES } from '@/lib/constants';
import { LiveDataBadge } from './LiveDataBadge';

interface SecurityPipelineProps {
  toolName: string;
  /** Optional key to look up TOOL_NARRATIVES when it differs from toolName */
  narrativeKey?: string;
  parameters?: Record<string, unknown>;
  isGenerating?: boolean;
  isWriteOperation?: boolean;
  blocked?: boolean;
  blockStage?: string;
}

const PIPELINE_STAGES = [
  { key: 'auth', label: 'Auth', icon: Shield, color: 'blue' },
  { key: 'policy', label: 'Policy', icon: FileCheck, color: 'purple' },
  { key: 'injection', label: 'Injection Scan', icon: Scan, color: 'amber' },
  { key: 'pii', label: 'PII Detect', icon: Fingerprint, color: 'rose' },
  { key: 'forward', label: 'Forward to Rovo', icon: Send, color: 'indigo' },
  { key: 'response', label: 'Response Scan', icon: Eye, color: 'teal' },
  { key: 'audit', label: 'Audit Log', icon: BookOpen, color: 'green' },
];

type StageStatus = 'pending' | 'processing' | 'passed' | 'blocked';

export function SecurityPipeline({
  toolName,
  narrativeKey,
  parameters,
  isGenerating,
  isWriteOperation,
  blocked,
  blockStage,
}: SecurityPipelineProps) {
  const [stageStatuses, setStageStatuses] = useState<StageStatus[]>(
    PIPELINE_STAGES.map(() => 'pending')
  );
  const [showNarrative, setShowNarrative] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  const narrative = TOOL_NARRATIVES[narrativeKey ?? toolName];

  // Animate stages sequentially when generating
  useEffect(() => {
    if (!isGenerating) {
      // When not generating, show all as passed (or blocked if applicable)
      const blockIdx = blockStage
        ? PIPELINE_STAGES.findIndex((s) => s.key === blockStage)
        : -1;
      setStageStatuses(
        PIPELINE_STAGES.map((_, i) => {
          if (blockIdx >= 0 && i === blockIdx) return 'blocked';
          if (blockIdx >= 0 && i > blockIdx) return 'pending';
          return 'passed';
        })
      );
      setAnimationComplete(true);
      return;
    }

    // Reset on new generation
    setAnimationComplete(false);
    setStageStatuses(PIPELINE_STAGES.map(() => 'pending'));

    const blockIdx = blockStage
      ? PIPELINE_STAGES.findIndex((s) => s.key === blockStage)
      : -1;

    const timers: NodeJS.Timeout[] = [];
    PIPELINE_STAGES.forEach((_, i) => {
      // Start processing
      const processDelay = i * 350;
      timers.push(
        setTimeout(() => {
          setStageStatuses((prev) => {
            const next = [...prev];
            next[i] = 'processing';
            return next;
          });
        }, processDelay)
      );

      // Complete stage
      const completeDelay = processDelay + 300;
      timers.push(
        setTimeout(() => {
          setStageStatuses((prev) => {
            const next = [...prev];
            if (blockIdx >= 0 && i === blockIdx) {
              next[i] = 'blocked';
            } else if (blockIdx >= 0 && i > blockIdx) {
              // Don't advance past blocked stage
            } else {
              next[i] = 'passed';
            }
            return next;
          });
          if (i === PIPELINE_STAGES.length - 1) {
            setAnimationComplete(true);
          }
        }, completeDelay)
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [isGenerating, blockStage]);

  return (
    <div className="rounded-xl border-l-4 border-claude-orange bg-amber-50/60 p-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-claude-orange" />
          <code className="text-sm font-mono font-semibold text-anthropic-900">
            {toolName}
          </code>
          {isWriteOperation && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">
              WRITE
            </span>
          )}
        </div>
        <LiveDataBadge />
      </div>

      {/* Pipeline Visualization */}
      <div className="relative">
        <div className="flex items-center justify-between gap-0 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage, i) => {
            const status = stageStatuses[i];
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="flex items-center shrink-0">
                {/* Stage Node */}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`
                      w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300
                      ${status === 'pending' ? 'bg-gray-100 text-gray-400' : ''}
                      ${status === 'processing' ? 'bg-amber-100 text-amber-600 ring-2 ring-amber-300 animate-pulse' : ''}
                      ${status === 'passed' ? 'bg-green-100 text-green-600' : ''}
                      ${status === 'blocked' ? 'bg-red-100 text-red-600 ring-2 ring-red-300' : ''}
                    `}
                  >
                    {status === 'processing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : status === 'passed' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : status === 'blocked' ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium whitespace-nowrap transition-colors duration-300 ${
                      status === 'passed'
                        ? 'text-green-700'
                        : status === 'blocked'
                          ? 'text-red-700'
                          : status === 'processing'
                            ? 'text-amber-700'
                            : 'text-gray-400'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>

                {/* Connector Line */}
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className="w-4 sm:w-8 h-px mx-1 relative">
                    <div className="absolute inset-0 bg-gray-200" />
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                        stageStatuses[i + 1] !== 'pending'
                          ? 'bg-green-400 w-full'
                          : status === 'passed'
                            ? 'bg-green-400 w-full'
                            : status === 'blocked'
                              ? 'bg-red-400 w-1/2'
                              : 'w-0'
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable sections */}
      <div className="mt-3 space-y-1">
        {/* Narrative toggle */}
        {narrative && (
          <div>
            <button
              onClick={() => setShowNarrative(!showNarrative)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${showNarrative ? 'rotate-180' : ''}`}
              />
              How this works
            </button>
            {showNarrative && (
              <p className="mt-2 text-sm text-gray-700 leading-relaxed pl-4 border-l-2 border-gray-200">
                {narrative}
              </p>
            )}
          </div>
        )}

        {/* Parameters toggle */}
        {parameters && Object.keys(parameters).length > 0 && (
          <div>
            <button
              onClick={() => setShowParams(!showParams)}
              className="flex items-center gap-1 text-xs font-medium text-claude-orange hover:text-amber-700 transition-colors"
            >
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${showParams ? 'rotate-180' : ''}`}
              />
              View request parameters
            </button>
            {showParams && (
              <pre className="mt-2 p-3 bg-anthropic-900 text-amber-100 rounded-lg text-xs font-mono overflow-x-auto">
                {JSON.stringify(parameters, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
