"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Play, RotateCcw, Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gatewayFetch } from "@/lib/api";

interface MatchedRule {
  id: string;
  name: string;
  action: string;
  priority: number;
  conditions: Record<string, unknown>;
}

interface ScanResult {
  clean: boolean;
  threats: string[];
}

interface SimulationResult {
  decision: "allow" | "deny" | "require_approval" | "log_only";
  matchedRules: MatchedRule[];
  scanResults: ScanResult;
  evaluatedAt: string;
}

export default function PolicySimulatorPage() {
  const { getToken } = useAuth();
  const [serverName, setServerName] = useState("");
  const [toolName, setToolName] = useState("");
  const [paramsJson, setParamsJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const clearResults = useCallback(() => {
    setResult(null);
  }, []);

  async function handleEvaluate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    let parsedParams: Record<string, unknown> = {};
    if (paramsJson.trim()) {
      try {
        parsedParams = JSON.parse(paramsJson);
      } catch {
        toast.error("Invalid JSON in parameters field");
        setLoading(false);
        return;
      }
    }

    try {
      const token = await getToken();
      if (!token) return;

      const data = await gatewayFetch<SimulationResult>(
        "/api/policies/simulate",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            serverName,
            toolName,
            params: parsedParams,
          }),
        }
      );
      setResult(data);
      toast.success("Evaluation complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Simulation failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setServerName("");
    setToolName("");
    setParamsJson("");
    setResult(null);
  }

  const decisionColor = (decision: string) => {
    switch (decision) {
      case "allow":
        return "bg-emerald-500/15 text-emerald-400";
      case "deny":
        return "bg-red-500/15 text-red-400";
      case "require_approval":
        return "bg-amber-500/15 text-amber-400";
      case "log_only":
        return "bg-cyan-500/15 text-cyan-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const DecisionIcon = ({ decision }: { decision: string }) => {
    switch (decision) {
      case "allow":
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "deny":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "require_approval":
        return <Shield className="w-5 h-5 text-amber-400" />;
      default:
        return <Shield className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/policies" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-xl font-semibold text-foreground">Policy Simulator</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simulate a Tool Call</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEvaluate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serverName">Server Name</Label>
                <Input
                  id="serverName"
                  required
                  placeholder="e.g. partner-enablement"
                  value={serverName}
                  onChange={(e) => {
                    setServerName(e.target.value);
                    clearResults();
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="toolName">Tool Name</Label>
                <Input
                  id="toolName"
                  required
                  placeholder="e.g. analyze_project"
                  value={toolName}
                  onChange={(e) => {
                    setToolName(e.target.value);
                    clearResults();
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="params">Parameters (JSON, optional)</Label>
                <textarea
                  id="params"
                  rows={5}
                  value={paramsJson}
                  onChange={(e) => {
                    setParamsJson(e.target.value);
                    clearResults();
                  }}
                  className="flex w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                  placeholder={'{\n  "projectKey": "HEALTH",\n  "responseFormat": "markdown"\n}'}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="animate-spin mr-1">&#9696;</span>
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Evaluate
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Decision */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Decision</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <DecisionIcon decision={result.decision} />
                    <span
                      className={`text-sm font-semibold px-3 py-1 rounded-full ${decisionColor(result.decision)}`}
                    >
                      {result.decision.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Evaluated at {new Date(result.evaluatedAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              {/* Matched Rules */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Matched Rules ({result.matchedRules.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.matchedRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No rules matched this tool call. Default action applied.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {result.matchedRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono w-8">
                              #{rule.priority}
                            </span>
                            <span className="text-sm font-medium text-foreground">
                              {rule.name}
                            </span>
                          </div>
                          <Badge
                            className={decisionColor(rule.action)}
                            variant="secondary"
                          >
                            {rule.action}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Scan Results */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Injection Scan</CardTitle>
                </CardHeader>
                <CardContent>
                  {result.scanResults.clean ? (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">No threats detected</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {result.scanResults.threats.length} threat(s) detected
                        </span>
                      </div>
                      <ul className="space-y-1 ml-6">
                        {result.scanResults.threats.map((threat, i) => (
                          <li
                            key={i}
                            className="text-sm text-red-400 list-disc"
                          >
                            {threat}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Shield className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  No simulation results yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Fill in the server name, tool name, and optional parameters,
                  then click Evaluate to see which policies would apply.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
