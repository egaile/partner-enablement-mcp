"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Info } from "lucide-react";
import { gatewayFetch } from "@/lib/api";

type AuthMethod = "none" | "basic" | "bearer";

export default function NewServerPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    transport: "http" as "stdio" | "http",
    url: "",
    command: "",
    args: "",
  });
  const [authMethod, setAuthMethod] = useState<AuthMethod>("none");
  const [authEmail, setAuthEmail] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRovoUrl = form.url.includes("mcp.atlassian.com");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const token = await getToken();
      if (!token) return;

      const body: Record<string, unknown> = {
        name: form.name,
        transport: form.transport,
      };
      if (form.transport === "http") {
        body.url = form.url;

        // Build auth headers
        if (authMethod === "basic" && authEmail && authToken) {
          const encoded = btoa(`${authEmail}:${authToken}`);
          body.authHeaders = { Authorization: `Basic ${encoded}` };
        } else if (authMethod === "bearer" && authToken) {
          body.authHeaders = { Authorization: `Bearer ${authToken}` };
        }
      } else {
        body.command = form.command;
        if (form.args.trim()) {
          body.args = form.args.split(" ").filter(Boolean);
        }
      }

      await gatewayFetch("/api/servers", token, {
        method: "POST",
        body: JSON.stringify(body),
      });

      toast.success("Server added successfully");
      router.push("/servers");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create server";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Add MCP Server</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Server Name
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="e.g. atlassian-rovo"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Transport
          </label>
          <select
            value={form.transport}
            onChange={(e) =>
              setForm({
                ...form,
                transport: e.target.value as "stdio" | "http",
              })
            }
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
          >
            <option value="http">HTTP</option>
            <option value="stdio">Stdio</option>
          </select>
        </div>

        {form.transport === "http" ? (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Server URL
              </label>
              <input
                type="url"
                required
                value={form.url}
                onChange={(e) => {
                  const url = e.target.value;
                  setForm({ ...form, url });
                  // Auto-suggest auth method for Rovo
                  if (url.includes("mcp.atlassian.com") && authMethod === "none") {
                    setAuthMethod("basic");
                  }
                }}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
                placeholder="https://mcp.atlassian.com/v1/mcp"
              />
            </div>

            {/* Rovo hint */}
            {isRovoUrl && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-300">
                  Atlassian Rovo MCP Server detected. Use <strong>Basic Auth</strong> with
                  your Atlassian email and an{" "}
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-200"
                  >
                    API token
                  </a>
                  , or <strong>Bearer</strong> with an OAuth access token.
                </p>
              </div>
            )}

            {/* Auth method selector */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Authentication
              </label>
              <select
                value={authMethod}
                onChange={(e) => setAuthMethod(e.target.value as AuthMethod)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
              >
                <option value="none">None</option>
                <option value="basic">Basic Auth (email + API token)</option>
                <option value="bearer">Bearer Token</option>
              </select>
            </div>

            {/* Basic auth fields */}
            {authMethod === "basic" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    API Token
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      required
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
                      placeholder="Your Atlassian API token"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showToken ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Bearer token field */}
            {authMethod === "bearer" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Bearer Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    required
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
                    placeholder="OAuth access token or service account key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Command
              </label>
              <input
                type="text"
                required
                value={form.command}
                onChange={(e) =>
                  setForm({ ...form, command: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
                placeholder="node"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Arguments (space-separated)
              </label>
              <input
                type="text"
                value={form.args}
                onChange={(e) =>
                  setForm({ ...form, args: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
                placeholder="dist/index.js"
              />
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Adding..." : "Add Server"}
        </button>
      </form>
    </div>
  );
}
