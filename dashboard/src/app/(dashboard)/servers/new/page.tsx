"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { gatewayFetch } from "@/lib/api";

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
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
            placeholder="e.g. partner-enablement"
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
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Server URL
            </label>
            <input
              type="url"
              required
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 text-foreground"
              placeholder="http://localhost:3000/mcp"
            />
          </div>
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
