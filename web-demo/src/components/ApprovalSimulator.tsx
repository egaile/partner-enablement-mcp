'use client';

import { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Terminal,
} from 'lucide-react';
import { SecurityPipeline } from '@/components/SecurityPipeline';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface ApprovalSimulatorProps {
  toolName: string;
  displayName: string;
  exampleParams: Record<string, unknown>;
  onApprove: () => void;
  onReject: () => void;
  decision: 'pending' | 'approved' | 'rejected' | null;
}

export function ApprovalSimulator({
  toolName,
  displayName,
  exampleParams,
  onApprove,
  onReject,
  decision,
}: ApprovalSimulatorProps) {
  const [showPipeline, setShowPipeline] = useState(false);

  const handleApprove = () => {
    onApprove();
    setShowPipeline(true);
  };

  const handleReject = () => {
    onReject();
    setShowPipeline(true);
  };

  // Truncate JSON preview to first 3 lines
  const jsonPreview = JSON.stringify(exampleParams, null, 2)
    .split('\n')
    .slice(0, 4)
    .join('\n');
  const hasMore = JSON.stringify(exampleParams, null, 2).split('\n').length > 4;

  return (
    <div className="animate-fade-in">
      <Card variant="default" padding="none" className="border-amber-200 bg-amber-50/40 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-amber-100/60 border-b border-amber-200">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-amber-800">Approval Required</h4>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Tool name */}
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-gray-400" />
            <code className="text-xs font-mono font-medium text-anthropic-900">{toolName}</code>
          </div>

          {/* Parameters preview */}
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Parameters</p>
            <pre className="p-2.5 bg-anthropic-900 text-amber-100 rounded-lg text-xs font-mono whitespace-pre-wrap break-all">
              {jsonPreview}{hasMore ? '\n  ...' : ''}
            </pre>
          </div>

          {/* Requesting user */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <User className="w-3.5 h-3.5" />
            <span>Requesting user: <span className="font-mono text-gray-600">ai-agent@enterprise.com</span></span>
          </div>

          {/* Decision buttons or result */}
          {decision === null || decision === 'pending' ? (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleApprove}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={handleReject}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
          ) : decision === 'approved' ? (
            <div className="flex items-center gap-2 pt-1 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <Badge variant="green" size="md">Approved</Badge>
              <span className="text-xs text-gray-400 ml-auto">
                Tool call forwarded to Rovo
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1 animate-fade-in">
              <XCircle className="w-5 h-5 text-red-600" />
              <Badge variant="red" size="md">Rejected</Badge>
              <span className="text-xs text-gray-400 ml-auto">
                Tool call blocked by policy
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* SecurityPipeline after decision */}
      {showPipeline && decision && decision !== 'pending' && (
        <div className="mt-3 animate-fade-in">
          <SecurityPipeline
            toolName={toolName}
            parameters={exampleParams}
            isGenerating={false}
            isWriteOperation={true}
            blocked={decision === 'rejected'}
            blockStage={decision === 'rejected' ? 'policy' : undefined}
          />
        </div>
      )}
    </div>
  );
}
