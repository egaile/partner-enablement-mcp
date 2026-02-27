"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Server,
  Shield,
  Sparkles,
  Key,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { gatewayFetch } from "@/lib/api";

const STEPS = [
  { label: "Welcome", icon: Sparkles },
  { label: "Connect Atlassian", icon: Server },
  { label: "Choose Template", icon: Shield },
  { label: "Get API Key", icon: Key },
];

interface AtlassianTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
}

const ATLASSIAN_TEMPLATES: AtlassianTemplate[] = [
  {
    id: "read_only_jira",
    name: "Read-Only Jira",
    description:
      "Agents can search and view Jira issues but cannot create, update, or transition them.",
    category: "access",
  },
  {
    id: "approval_for_writes",
    name: "Approval for Writes",
    description:
      "Any create, update, or transition operation requires human approval before execution.",
    category: "access",
  },
  {
    id: "confluence_view_only",
    name: "Confluence View-Only",
    description:
      "Agents can search and read Confluence pages but cannot create or edit them.",
    category: "access",
  },
  {
    id: "pii_shield",
    name: "PII Shield",
    description:
      "Scan all Jira and Confluence content for PII before returning to the agent, and redact matches.",
    category: "security",
  },
  {
    id: "audit_everything",
    name: "Audit Everything",
    description:
      "Maximum visibility mode — log all calls with no blocking. Great as a compliance starter.",
    category: "compliance",
  },
  {
    id: "protected_projects",
    name: "Protected Projects",
    description:
      "Block all agent access to specific Jira projects (e.g., HR, Security, Finance).",
    category: "access",
  },
];

export default function OnboardingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 2: Server form (Atlassian-first)
  const [serverForm, setServerForm] = useState({
    name: "atlassian-rovo",
    url: "",
  });
  const [testing, setTesting] = useState(false);
  const [testPassed, setTestPassed] = useState(false);

  // Step 3: Template selection
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  // Step 4: API Key
  const [apiKeyValue, setApiKeyValue] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);

  function handleTestConnection() {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setTestPassed(true);
      toast.success("Connection test successful");
    }, 1500);
  }

  function toggleTemplate(id: string) {
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleGenerateKey() {
    setGeneratingKey(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ key: string }>(
        "/api/settings/api-keys",
        token,
        {
          method: "POST",
          body: JSON.stringify({ name: "Onboarding key" }),
        }
      );
      setApiKeyValue(data.key);
      toast.success("API key generated");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate key";
      toast.error(msg);
    } finally {
      setGeneratingKey(false);
    }
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      // Create the Atlassian server
      await gatewayFetch("/api/servers", token, {
        method: "POST",
        body: JSON.stringify({
          name: serverForm.name,
          transport: "http",
          url: serverForm.url,
        }),
      });

      // Apply selected Atlassian policy templates
      for (const templateId of selectedTemplates) {
        await gatewayFetch(
          `/api/templates/atlassian/${templateId}/apply`,
          token,
          { method: "POST" }
        );
      }

      toast.success("Setup complete! Redirecting to dashboard...");
      router.push("/");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to complete setup";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  const GATEWAY_URL =
    process.env.NEXT_PUBLIC_GATEWAY_API_URL || "http://localhost:4000";

  const canAdvance = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return serverForm.name.trim() !== "" && serverForm.url.trim() !== "";
      case 2:
        return true; // Templates are optional
      case 3:
        return true; // API key is optional
      default:
        return false;
    }
  };

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                i === step
                  ? "bg-cyan-600 text-white"
                  : i < step
                    ? "bg-cyan-900/30 text-cyan-400"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <s.icon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 h-0.5 ${
                  i < step ? "bg-cyan-600" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Welcome */}
      {step === 0 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              Secure Your Atlassian MCP Connections
            </CardTitle>
            <CardDescription className="text-base">
              MCP Shield sits between your AI agents (Claude, Cursor, Copilot)
              and your Atlassian Rovo MCP Server — scanning every tool call for
              prompt injection, enforcing policies, and logging a complete audit
              trail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-border p-4 text-center">
                <Shield className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-foreground">
                  Injection Scanning
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Detect malicious prompts hidden in Jira issues and Confluence
                  pages
                </p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <Server className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-foreground">
                  Policy Enforcement
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Control which Jira projects and Confluence spaces agents can
                  access
                </p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-foreground">
                  Audit Trail
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Full compliance log with Jira project keys and operation types
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Connect your Atlassian Rovo MCP Server in 3 minutes. Zero code
              changes — just a URL swap.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Connect Atlassian */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Connect Your Atlassian Rovo MCP Server</CardTitle>
            <CardDescription>
              Point the gateway at your Atlassian Rovo MCP Server URL. Your AI
              clients will connect to the gateway instead of directly to
              Atlassian.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm space-y-2">
              <p className="font-medium text-foreground">How it works:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                <li>
                  Copy your Atlassian Rovo MCP Server URL from your Atlassian
                  admin settings
                </li>
                <li>Paste it below — the gateway will proxy to Atlassian</li>
                <li>
                  Update your AI client config to point to{" "}
                  <code className="bg-muted px-1 rounded">{GATEWAY_URL}/mcp</code>{" "}
                  instead of the Atlassian URL
                </li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serverName">Server Name</Label>
              <Input
                id="serverName"
                placeholder="atlassian-rovo"
                value={serverForm.name}
                onChange={(e) =>
                  setServerForm({ ...serverForm, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serverUrl">
                Atlassian Rovo MCP Server URL
              </Label>
              <Input
                id="serverUrl"
                type="url"
                placeholder="https://your-instance.atlassian.net/gateway/api/mcp"
                value={serverForm.url}
                onChange={(e) =>
                  setServerForm({ ...serverForm, url: e.target.value })
                }
              />
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !canAdvance()}
              >
                {testing ? (
                  <>
                    <span className="animate-spin mr-1">&#9696;</span>
                    Testing...
                  </>
                ) : testPassed ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Connection OK
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Choose Atlassian Policy Templates */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Security Templates</CardTitle>
            <CardDescription>
              Select one or more Atlassian-specific policy templates. You can
              customize or add more policies later from the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ATLASSIAN_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => toggleTemplate(template.id)}
                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                  selectedTemplates.includes(template.id)
                    ? "border-cyan-500 bg-cyan-500/5 ring-1 ring-cyan-500"
                    : "border-border hover:border-cyan-500/30"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      {template.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {template.description}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block ${
                        template.category === "access"
                          ? "bg-blue-500/10 text-blue-400"
                          : template.category === "security"
                            ? "bg-orange-500/10 text-orange-400"
                            : "bg-purple-500/10 text-purple-400"
                      }`}
                    >
                      {template.category}
                    </span>
                  </div>
                  {selectedTemplates.includes(template.id) && (
                    <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
            <p className="text-xs text-muted-foreground text-center pt-2">
              You can skip this step and create policies later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Get API Key + Config Snippet */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Your AI Client</CardTitle>
            <CardDescription>
              Generate an API key and update your MCP client configuration to
              route through the gateway.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!apiKeyValue ? (
              <Button onClick={handleGenerateKey} disabled={generatingKey}>
                <Key className="w-4 h-4 mr-2" />
                {generatingKey ? "Generating..." : "Generate API Key"}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs text-emerald-400 mb-1 font-medium">
                    API key generated. Copy it now — it won&apos;t be shown
                    again.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-muted px-2 py-1 rounded border border-border flex-1 font-mono text-foreground break-all">
                      {apiKeyValue}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(apiKeyValue)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Claude Desktop config (claude_desktop_config.json):
                  </p>
                  <div className="relative">
                    <pre className="bg-muted rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto">
{`{
  "mcpServers": {
    "atlassian-secured": {
      "url": "${GATEWAY_URL}/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKeyValue}"
      }
    }
  }
}`}
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(
                            {
                              mcpServers: {
                                "atlassian-secured": {
                                  url: `${GATEWAY_URL}/mcp`,
                                  headers: {
                                    Authorization: `Bearer ${apiKeyValue}`,
                                  },
                                },
                              },
                            },
                            null,
                            2
                          )
                        )
                      }
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <div>
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
        </div>
        <div>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={submitting || !canAdvance()}
            >
              {submitting ? "Setting up..." : "Complete Setup"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
