"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
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

      router.push("/servers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-semibold">Add MCP Server</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Server Name
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            placeholder="e.g. partner-enablement"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="http">HTTP</option>
            <option value="stdio">Stdio</option>
          </select>
        </div>

        {form.transport === "http" ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Server URL
            </label>
            <input
              type="url"
              required
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="http://localhost:3000/mcp"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Command
              </label>
              <input
                type="text"
                required
                value={form.command}
                onChange={(e) =>
                  setForm({ ...form, command: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="node"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arguments (space-separated)
              </label>
              <input
                type="text"
                value={form.args}
                onChange={(e) =>
                  setForm({ ...form, args: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="dist/index.js"
              />
            </div>
          </>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Adding..." : "Add Server"}
        </button>
      </form>
    </div>
  );
}
