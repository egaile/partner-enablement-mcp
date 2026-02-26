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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gatewayFetch } from "@/lib/api";

const STEPS = [
  { label: "Welcome", icon: Sparkles },
  { label: "Connect Server", icon: Server },
  { label: "Create Policy", icon: Shield },
];

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  action: string;
  toolPattern: string[];
  serverPattern: string;
}

const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: "log_everything",
    name: "Log Everything",
    description:
      "Allow all tool calls but log every request for auditing purposes.",
    action: "log_only",
    toolPattern: ["*"],
    serverPattern: "*",
  },
  {
    id: "block_destructive",
    name: "Block Destructive",
    description:
      "Deny tool calls that match destructive patterns like delete, remove, or drop.",
    action: "deny",
    toolPattern: ["*delete*", "*remove*", "*drop*"],
    serverPattern: "*",
  },
  {
    id: "read_only",
    name: "Read-Only",
    description:
      "Deny write operations while allowing read-only tool calls.",
    action: "deny",
    toolPattern: ["*write*", "*create*", "*update*"],
    serverPattern: "*",
  },
];

export default function OnboardingPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 2: Server form
  const [serverForm, setServerForm] = useState({
    name: "",
    transport: "http" as "http" | "stdio",
    url: "",
    command: "",
    args: "",
  });
  const [testing, setTesting] = useState(false);
  const [testPassed, setTestPassed] = useState(false);

  // Step 3: Policy selection
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  function handleTestConnection() {
    setTesting(true);
    // Simulate a connection test
    setTimeout(() => {
      setTesting(false);
      setTestPassed(true);
      toast.success("Connection test successful");
    }, 1500);
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      // Create the server
      const serverBody: Record<string, unknown> = {
        name: serverForm.name,
        transport: serverForm.transport,
      };
      if (serverForm.transport === "http") {
        serverBody.url = serverForm.url;
      } else {
        serverBody.command = serverForm.command;
        if (serverForm.args.trim()) {
          serverBody.args = serverForm.args.split(" ").filter(Boolean);
        }
      }

      await gatewayFetch("/api/servers", token, {
        method: "POST",
        body: JSON.stringify(serverBody),
      });

      // Create the policy if a template was selected
      if (selectedTemplate) {
        const template = POLICY_TEMPLATES.find(
          (t) => t.id === selectedTemplate
        );
        if (template) {
          await gatewayFetch("/api/policies", token, {
            method: "POST",
            body: JSON.stringify({
              name: template.name,
              description: template.description,
              action: template.action,
              priority: 100,
              conditions: {
                tool_pattern: template.toolPattern,
                server_pattern: template.serverPattern,
              },
              enabled: true,
            }),
          });
        }
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

  const canAdvance = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        if (serverForm.transport === "http") {
          return serverForm.name.trim() !== "" && serverForm.url.trim() !== "";
        }
        return (
          serverForm.name.trim() !== "" && serverForm.command.trim() !== ""
        );
      case 2:
        return true; // Policy template is optional
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
                  ? "bg-gray-900 text-white"
                  : i < step
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
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
                  i < step ? "bg-green-300" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              Welcome to MCP Gateway
            </CardTitle>
            <CardDescription className="text-base">
              The security gateway sits between your AI agents and MCP servers,
              providing policy enforcement, injection scanning, and audit
              logging for every tool call.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-200 p-4 text-center">
                <Shield className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium">Policy Enforcement</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Allow, deny, or require approval for tool calls
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 text-center">
                <Server className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <h3 className="text-sm font-medium">Multi-Server</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Aggregate tools from multiple MCP servers
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 text-center">
                <Sparkles className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <h3 className="text-sm font-medium">Audit & Alerts</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Full audit trail with real-time alerting
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Let&apos;s get started by connecting your first MCP server and
              setting up a basic policy.
            </p>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Connect Your First Server</CardTitle>
            <CardDescription>
              Register an MCP server that the gateway will proxy requests to.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serverName">Server Name</Label>
              <Input
                id="serverName"
                placeholder="e.g. partner-enablement"
                value={serverForm.name}
                onChange={(e) =>
                  setServerForm({ ...serverForm, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Transport</Label>
              <Select
                value={serverForm.transport}
                onValueChange={(val: "http" | "stdio") =>
                  setServerForm({
                    ...serverForm,
                    transport: val,
                    url: "",
                    command: "",
                    args: "",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="stdio">Stdio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {serverForm.transport === "http" ? (
              <div className="space-y-2">
                <Label htmlFor="serverUrl">Server URL</Label>
                <Input
                  id="serverUrl"
                  type="url"
                  placeholder="http://localhost:3000/mcp"
                  value={serverForm.url}
                  onChange={(e) =>
                    setServerForm({ ...serverForm, url: e.target.value })
                  }
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="serverCommand">Command</Label>
                  <Input
                    id="serverCommand"
                    placeholder="node"
                    value={serverForm.command}
                    onChange={(e) =>
                      setServerForm({
                        ...serverForm,
                        command: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serverArgs">
                    Arguments (space-separated)
                  </Label>
                  <Input
                    id="serverArgs"
                    placeholder="dist/index.js"
                    value={serverForm.args}
                    onChange={(e) =>
                      setServerForm({ ...serverForm, args: e.target.value })
                    }
                  />
                </div>
              </>
            )}

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
                    <CheckCircle className="w-4 h-4 text-green-600" />
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

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Create Your First Policy</CardTitle>
            <CardDescription>
              Choose a template to get started quickly. You can customize
              policies later from the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {POLICY_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() =>
                  setSelectedTemplate(
                    selectedTemplate === template.id ? null : template.id
                  )
                }
                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                  selectedTemplate === template.id
                    ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium">{template.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          template.action === "log_only"
                            ? "bg-blue-100 text-blue-700"
                            : template.action === "deny"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {template.action}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {template.toolPattern.join(", ")}
                      </span>
                    </div>
                  </div>
                  {selectedTemplate === template.id && (
                    <CheckCircle className="w-5 h-5 text-gray-900 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
            <p className="text-xs text-gray-400 text-center pt-2">
              You can skip this step and create policies later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <div>
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
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
