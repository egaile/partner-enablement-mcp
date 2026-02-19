import { CheckCircle2 } from 'lucide-react';
import type { Step } from '@/types/api';
import { STEP_DEFINITIONS } from '@/lib/constants';

interface StepProgressProps {
  currentStep: Step;
  completedSteps: Set<string>;
}

export function StepProgress({ currentStep, completedSteps }: StepProgressProps) {
  return (
    <div className="border-b border-gray-200 bg-gray-50/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          {STEP_DEFINITIONS.map((step, index) => {
            const isActive = currentStep === step.key;
            const isComplete = completedSteps.has(step.key);

            return (
              <div key={step.key} className="flex items-center shrink-0">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors text-sm ${
                    isActive
                      ? 'bg-claude-orange/10 text-claude-orange font-semibold'
                      : isComplete
                        ? 'bg-green-50 text-green-700'
                        : 'text-gray-400'
                  }`}
                >
                  {isComplete && !isActive ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${
                        isActive
                          ? 'bg-claude-orange text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {index < STEP_DEFINITIONS.length - 1 && (
                  <div
                    className={`w-6 sm:w-10 h-px mx-1 ${
                      isComplete ? 'bg-green-300' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
