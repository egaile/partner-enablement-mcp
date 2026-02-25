"use client";

import { useState } from "react";

interface RuleBuilderProps {
  onSubmit: (rule: {
    name: string;
    description: string;
    priority: number;
    action: string;
    conditions: {
      servers?: string[];
      tools?: string[];
    };
  }) => void;
  submitting?: boolean;
}

export default function RuleBuilder({ onSubmit, submitting }: RuleBuilderProps) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    priority: 1000,
    action: "deny",
    servers: "",
    tools: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: form.name,
      description: form.description,
      priority: form.priority,
      action: form.action,
      conditions: {
        servers: form.servers
          ? form.servers.split(",").map((s) => s.trim())
          : undefined,
        tools: form.tools
          ? form.tools.split(",").map((s) => s.trim())
          : undefined,
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Rule Name
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="e.g. Block dangerous tools after hours"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action
          </label>
          <select
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="allow">Allow</option>
            <option value="deny">Deny</option>
            <option value="require_approval">Require Approval</option>
            <option value="log_only">Log Only</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority (lower = higher)
          </label>
          <input
            type="number"
            min={0}
            max={10000}
            value={form.priority}
            onChange={(e) =>
              setForm({ ...form, priority: parseInt(e.target.value) || 1000 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Server Patterns (comma-separated globs)
        </label>
        <input
          type="text"
          value={form.servers}
          onChange={(e) => setForm({ ...form, servers: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="e.g. partner-*, github-mcp"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tool Patterns (comma-separated globs)
        </label>
        <input
          type="text"
          value={form.tools}
          onChange={(e) => setForm({ ...form, tools: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="e.g. *_delete_*, *_write_*"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create Rule"}
      </button>
    </form>
  );
}
