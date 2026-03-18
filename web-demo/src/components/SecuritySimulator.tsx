'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Scan,
  Fingerprint,
  Eye,
  EyeOff,
  ChevronDown,
  Loader2,
  Zap,
  Terminal,
  Clock,
} from 'lucide-react';
import { ATTACK_SCENARIOS, ATTACK_CATEGORIES, STRATEGY_INFO } from '@/lib/attack-scenarios';
import type { AttackScenario } from '@/lib/attack-scenarios';
import type { ScanApiResult, ThreatIndicator } from '@/types/api';
import { SecurityPipeline } from '@/components/SecurityPipeline';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface SecuritySimulatorProps {
  onBack: () => void;
}

const SEVERITY_VARIANT: Record<string, 'red' | 'orange' | 'amber' | 'blue' | 'gray'> = {
  critical: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'blue',
  info: 'gray',
};

const STRATEGY_VARIANT: Record<string, 'red' | 'orange' | 'amber' | 'blue' | 'purple' | 'gray'> = {
  pattern_match: 'red',
  unicode_analysis: 'amber',
  structural: 'blue',
  exfiltration: 'orange',
  atlassian_injection: 'purple',
  pii_scanner: 'red',
};

const PII_TYPE_LABELS: Record<string, string> = {
  ssn: 'SSN',
  credit_card: 'Credit Card',
  email: 'Email',
  phone: 'Phone',
  ip_address: 'IP Address',
  date_of_birth: 'Date of Birth',
  medical_record: 'Medical Record',
};

function getCategoryColor(categoryId: string): string {
  const cat = ATTACK_CATEGORIES.find((c) => c.id === categoryId);
  return cat?.color ?? 'gray';
}

function categoryDotClass(color: string): string {
  const map: Record<string, string> = {
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    rose: 'bg-rose-500',
    gray: 'bg-gray-400',
  };
  return map[color] ?? 'bg-gray-400';
}

export function SecuritySimulator({ onBack }: SecuritySimulatorProps) {
  const [selectedScenario, setSelectedScenario] = useState<AttackScenario | null>(null);
  const [customPayload, setCustomPayload] = useState('');
  const [scanResult, setScanResult] = useState<ScanApiResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const handleScan = async () => {
    if (!selectedScenario) return;

    const payload =
      selectedScenario.id === 'freeform' ? customPayload : selectedScenario.payload;
    if (!payload.trim()) return;

    setIsScanning(true);
    setScanResult(null);

    try {
      const res = await fetch('/api/tools/security-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, mode: 'scan' }),
      });
      const data: ScanApiResult = await res.json();
      setScanResult(data);
    } catch {
      setScanResult(null);
    } finally {
      setIsScanning(false);
    }
  };

  const activePayload =
    selectedScenario?.id === 'freeform' ? customPayload : (selectedScenario?.payload ?? '');

  const blockStage = scanResult
    ? scanResult.threats.indicators.length > 0
      ? 'injection'
      : scanResult.pii.detected
        ? 'pii'
        : undefined
    : undefined;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Home
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-anthropic-900 mb-1">
              Security Threat Simulator
            </h1>
            <p className="text-sm text-gray-500 max-w-xl leading-relaxed">
              Red team playground — pick an attack scenario and watch the MCP Security Gateway
              scanner dissect, classify, and block the payload in real time.
            </p>
          </div>
          <Badge variant="purple" size="md">CISO / Security Architect</Badge>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="space-y-2">
            {ATTACK_SCENARIOS.map((scenario) => {
              const isSelected = selectedScenario?.id === scenario.id;
              const color = getCategoryColor(scenario.category);

              return (
                <button
                  key={scenario.id}
                  onClick={() => {
                    setSelectedScenario(scenario);
                    setScanResult(null);
                  }}
                  className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                    isSelected
                      ? 'border-claude-orange bg-orange-50/50 shadow-md shadow-orange-500/10'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${categoryDotClass(color)}`} />
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {scenario.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                    {scenario.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={SEVERITY_VARIANT[scenario.expectedSeverity] ?? 'gray'}>
                      {scenario.expectedSeverity}
                    </Badge>
                    <span className="text-[10px] text-gray-400 font-mono truncate">
                      {scenario.category}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom payload textarea (shown when freeform is selected) */}
          {selectedScenario?.id === 'freeform' && (
            <div className="mt-3 animate-fade-in">
              <textarea
                value={customPayload}
                onChange={(e) => setCustomPayload(e.target.value)}
                placeholder="Type your attack payload here..."
                rows={5}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-800 placeholder-gray-400 focus:border-claude-orange focus:ring-1 focus:ring-claude-orange/30 resize-none"
              />
            </div>
          )}

          {/* Scan Button */}
          <button
            onClick={handleScan}
            disabled={!selectedScenario || isScanning || (!activePayload.trim())}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Scan className="w-4 h-4" />
                Scan Payload
              </>
            )}
          </button>
        </div>

        {/* Right Main Panel */}
        <div className="flex-1 min-w-0">
          {!scanResult && !isScanning && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">
                Select an attack scenario
              </h3>
              <p className="text-sm text-gray-400 max-w-sm">
                Choose a pre-built attack from the sidebar or write a custom payload, then hit
                &ldquo;Scan Payload&rdquo; to see how the gateway responds.
              </p>
            </div>
          )}

          {isScanning && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-claude-orange animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Running Scanner Pipeline
              </h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Executing 5 threat detection strategies and PII scanner against the payload...
              </p>
            </div>
          )}

          {scanResult && !isScanning && (
            <div className="space-y-6 animate-fade-in">
              {/* Scanner Results Header */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-anthropic-900">Scanner Results</h2>
                    <Badge variant="gray">
                      <Clock className="w-3 h-3 mr-1" />
                      {scanResult.threats.scanDurationMs.toFixed(1)}ms
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {scanResult.shouldBlock ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 border border-red-200 rounded-lg">
                        <ShieldAlert className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-bold text-red-700">BLOCKED</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 border border-green-200 rounded-lg">
                        <ShieldCheck className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-bold text-green-700">PASSED</span>
                      </div>
                    )}
                    {scanResult.threats.highestSeverity && (
                      <Badge
                        variant={SEVERITY_VARIANT[scanResult.threats.highestSeverity] ?? 'gray'}
                        size="md"
                      >
                        {scanResult.threats.highestSeverity.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Threat Indicators */}
                {scanResult.threats.indicators.length > 0 && (
                  <Card variant="default" padding="none" className="overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <h3 className="text-sm font-semibold text-gray-800">
                          Threat Indicators ({scanResult.threats.indicators.length})
                        </h3>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {scanResult.threats.indicators.map((indicator, i) => (
                        <IndicatorRow key={i} indicator={indicator} index={i} />
                      ))}
                    </div>
                  </Card>
                )}

                {scanResult.threats.indicators.length === 0 && !scanResult.pii.detected && (
                  <Card variant="default" className="text-center py-8">
                    <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">
                      No threats or PII detected in this payload.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      The gateway would allow this request through.
                    </p>
                  </Card>
                )}
              </div>

              {/* PII Detection Section */}
              {scanResult.pii.detected && (
                <div className="animate-fade-in">
                  <Card variant="default" padding="none" className="overflow-hidden">
                    <div className="px-4 py-3 bg-rose-50 border-b border-rose-100">
                      <div className="flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-rose-500" />
                        <h3 className="text-sm font-semibold text-gray-800">
                          PII Detected ({scanResult.pii.matches.length} match{scanResult.pii.matches.length !== 1 ? 'es' : ''})
                        </h3>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* PII match list */}
                      <div className="space-y-2">
                        {scanResult.pii.matches.map((match, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 text-sm animate-fade-in"
                            style={{ animationDelay: `${i * 80}ms` }}
                          >
                            <Badge variant="red">
                              {PII_TYPE_LABELS[match.type] ?? match.type}
                            </Badge>
                            <span className="text-xs text-gray-500 font-mono">
                              pos {match.start}&ndash;{match.end}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Redaction comparison */}
                      {scanResult.redactedText && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Eye className="w-3.5 h-3.5 text-red-500" />
                              <span className="text-xs font-semibold text-red-700">Original</span>
                            </div>
                            <pre className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-mono text-red-800 whitespace-pre-wrap break-all">
                              {activePayload}
                            </pre>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <EyeOff className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-xs font-semibold text-green-700">Redacted</span>
                            </div>
                            <pre className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs font-mono text-green-800 whitespace-pre-wrap break-all">
                              {scanResult.redactedText}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {/* SecurityPipeline with Blocking */}
              {selectedScenario && (
                <SecurityPipeline
                  toolName={selectedScenario.toolName}
                  parameters={{ [selectedScenario.paramField]: activePayload.substring(0, 120) + (activePayload.length > 120 ? '...' : '') }}
                  isGenerating={false}
                  isWriteOperation={selectedScenario.toolName.startsWith('update') || selectedScenario.toolName.startsWith('create') || selectedScenario.toolName.startsWith('add')}
                  blocked={scanResult.shouldBlock}
                  blockStage={blockStage}
                />
              )}

              {/* Side-by-Side Comparison (collapsible) */}
              {scanResult.shouldBlock && (
                <div>
                  <button
                    onClick={() => setShowComparison(!showComparison)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${showComparison ? 'rotate-180' : ''}`}
                    />
                    {showComparison ? 'Hide' : 'Show'} Gateway Comparison
                  </button>

                  {showComparison && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-fade-in">
                      {/* Without Gateway */}
                      <Card variant="default" padding="none" className="border-2 border-red-300 overflow-hidden">
                        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-red-600" />
                            <h4 className="text-sm font-semibold text-red-800">
                              Without Gateway
                            </h4>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2 text-xs text-red-700">
                            <Zap className="w-3.5 h-3.5" />
                            <span>Payload reaches Atlassian unscanned</span>
                          </div>
                          <pre className="p-3 bg-red-50/50 rounded-lg text-xs font-mono text-red-800 whitespace-pre-wrap break-all border border-red-100">
                            {activePayload.substring(0, 300)}
                            {activePayload.length > 300 ? '...' : ''}
                          </pre>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="red">No scan</Badge>
                            <Badge variant="red">No audit log</Badge>
                            <Badge variant="red">No PII redaction</Badge>
                          </div>
                        </div>
                      </Card>

                      {/* With Gateway */}
                      <Card variant="default" padding="none" className="border-2 border-green-300 overflow-hidden">
                        <div className="px-4 py-3 bg-green-50 border-b border-green-200">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-green-600" />
                            <h4 className="text-sm font-semibold text-green-800">
                              With MCP Gateway
                            </h4>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2 text-xs text-green-700">
                            <Shield className="w-3.5 h-3.5" />
                            <span>Payload blocked before reaching Atlassian</span>
                          </div>
                          <div className="p-3 bg-green-50/50 rounded-lg border border-green-100 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="red">BLOCKED</Badge>
                              <span className="text-xs text-gray-600">
                                {scanResult.threats.indicators.length} threat{scanResult.threats.indicators.length !== 1 ? 's' : ''} detected
                              </span>
                            </div>
                            {scanResult.threats.highestSeverity && (
                              <p className="text-xs text-gray-500">
                                Highest severity:{' '}
                                <span className="font-semibold">
                                  {scanResult.threats.highestSeverity}
                                </span>
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="green">5 strategies scanned</Badge>
                            <Badge variant="green">Audit logged</Badge>
                            <Badge variant="green">Alert fired</Badge>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Individual threat indicator row */
function IndicatorRow({ indicator, index }: { indicator: ThreatIndicator; index: number }) {
  const strategyInfo = STRATEGY_INFO[indicator.strategy];
  const strategyVariant = STRATEGY_VARIANT[indicator.strategy] ?? 'gray';
  const severityVariant = SEVERITY_VARIANT[indicator.severity] ?? 'gray';

  return (
    <div
      className="px-4 py-3 animate-fade-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <Badge variant={strategyVariant}>
            {strategyInfo?.name ?? indicator.strategy}
          </Badge>
          <Badge variant={severityVariant}>
            {indicator.severity}
          </Badge>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800">{indicator.description}</p>
          {indicator.matchedContent && (
            <pre className="mt-1.5 px-2.5 py-1.5 bg-anthropic-900 text-amber-100 rounded text-xs font-mono whitespace-pre-wrap break-all">
              {indicator.matchedContent}
            </pre>
          )}
          <span className="text-[10px] text-gray-400 font-mono mt-1 block">
            {indicator.fieldPath}
          </span>
        </div>
      </div>
    </div>
  );
}
