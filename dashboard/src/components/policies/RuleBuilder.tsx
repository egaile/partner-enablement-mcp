"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface RuleData {
  name: string;
  description: string;
  priority: number;
  action: string;
  conditions: {
    servers?: string[];
    tools?: string[];
    timeWindows?: { days: number[]; startHour: number; endHour: number }[];
  };
  modifiers?: {
    redactPII?: boolean;
    maxCallsPerMinute?: number;
    requireMFA?: boolean;
  };
}

interface RuleBuilderProps {
  onSubmit: (rule: RuleData) => void;
  submitting?: boolean;
}

const templates = [
  {
    name: "Block destructive tools",
    description: "Deny access to delete, drop, and destroy operations",
    action: "deny",
    priority: 100,
    servers: [],
    tools: ["*delete*", "*drop*", "*destroy*", "*remove*"],
  },
  {
    name: "Log everything",
    description: "Log all tool calls for auditing purposes",
    action: "log_only",
    priority: 9000,
    servers: ["*"],
    tools: ["*"],
  },
  {
    name: "Read-only access",
    description: "Allow only read/get/list operations, deny everything else",
    action: "allow",
    priority: 500,
    servers: ["*"],
    tools: ["*read*", "*get*", "*list*", "*search*", "*find*", "*query*"],
  },
  {
    name: "After-hours restriction",
    description: "Require approval for tool calls outside business hours",
    action: "require_approval",
    priority: 200,
    servers: ["*"],
    tools: ["*"],
    timeWindows: [{ days: [1, 2, 3, 4, 5], startHour: 18, endHour: 8 }],
  },
];

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RuleBuilder({ onSubmit, submitting }: RuleBuilderProps) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    priority: 1000,
    action: "deny",
    servers: [] as string[],
    tools: [] as string[],
  });

  // Tag input states
  const [serverInput, setServerInput] = useState("");
  const [toolInput, setToolInput] = useState("");

  // Collapsible sections
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Schedule
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleStart, setScheduleStart] = useState(18);
  const [scheduleEnd, setScheduleEnd] = useState(8);

  // Advanced modifiers
  const [redactPII, setRedactPII] = useState(false);
  const [maxCallsPerMinute, setMaxCallsPerMinute] = useState<number | "">("");
  const [requireMFA, setRequireMFA] = useState(false);

  function addTag(type: "servers" | "tools", value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!form[type].includes(trimmed)) {
      setForm({ ...form, [type]: [...form[type], trimmed] });
    }
    if (type === "servers") setServerInput("");
    else setToolInput("");
  }

  function removeTag(type: "servers" | "tools", index: number) {
    setForm({ ...form, [type]: form[type].filter((_, i) => i !== index) });
  }

  function handleKeyDown(type: "servers" | "tools", e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(type, type === "servers" ? serverInput : toolInput);
    }
  }

  function applyTemplate(t: typeof templates[0]) {
    setForm({
      name: t.name,
      description: t.description,
      priority: t.priority,
      action: t.action,
      servers: t.servers,
      tools: t.tools,
    });
    if (t.timeWindows) {
      setShowSchedule(true);
      setScheduleDays(t.timeWindows[0].days);
      setScheduleStart(t.timeWindows[0].startHour);
      setScheduleEnd(t.timeWindows[0].endHour);
    }
  }

  function toggleDay(day: number) {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rule: RuleData = {
      name: form.name,
      description: form.description,
      priority: form.priority,
      action: form.action,
      conditions: {
        servers: form.servers.length > 0 ? form.servers : undefined,
        tools: form.tools.length > 0 ? form.tools : undefined,
        timeWindows:
          showSchedule && scheduleDays.length > 0
            ? [{ days: scheduleDays, startHour: scheduleStart, endHour: scheduleEnd }]
            : undefined,
      },
    };

    if (showAdvanced && (redactPII || maxCallsPerMinute || requireMFA)) {
      rule.modifiers = {};
      if (redactPII) rule.modifiers.redactPII = true;
      if (maxCallsPerMinute) rule.modifiers.maxCallsPerMinute = Number(maxCallsPerMinute);
      if (requireMFA) rule.modifiers.requireMFA = true;
    }

    onSubmit(rule);
  }

  // Live preview
  function getPreview(): string {
    const parts: string[] = [];
    const actionLabel = form.action === "require_approval" ? "Require approval for" : `${form.action.charAt(0).toUpperCase() + form.action.slice(1)}`;

    parts.push(actionLabel);

    if (form.tools.length > 0) {
      parts.push(`tools matching [${form.tools.join(", ")}]`);
    } else {
      parts.push("all tools");
    }

    if (form.servers.length > 0) {
      parts.push(`on servers [${form.servers.join(", ")}]`);
    }

    if (showSchedule && scheduleDays.length > 0) {
      const dayNames = scheduleDays.map((d) => dayLabels[d]).join(", ");
      parts.push(`during ${scheduleStart}:00-${scheduleEnd}:00 on ${dayNames}`);
    }

    if (showAdvanced) {
      const mods: string[] = [];
      if (redactPII) mods.push("redact PII");
      if (maxCallsPerMinute) mods.push(`limit to ${maxCallsPerMinute} calls/min`);
      if (requireMFA) mods.push("require MFA");
      if (mods.length > 0) parts.push(`(${mods.join(", ")})`);
    }

    return parts.join(" ");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Templates */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Sparkles className="w-3.5 h-3.5 inline mr-1" />
          Start from a template
        </label>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => applyTemplate(t)}
              className="text-left p-3 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
            >
              <span className="text-sm font-medium block">{t.name}</span>
              <span className="text-xs text-gray-400">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Basic fields */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
        <Input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Block dangerous tools after hours"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <Input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
          <select
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
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
          <Input
            type="number"
            min={0}
            max={10000}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 1000 })}
          />
        </div>
      </div>

      {/* Server patterns - tag input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Server Patterns
        </label>
        <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg bg-white min-h-[40px]">
          {form.servers.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-sm font-mono"
            >
              {tag}
              <button type="button" onClick={() => removeTag("servers", i)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            value={serverInput}
            onChange={(e) => setServerInput(e.target.value)}
            onKeyDown={(e) => handleKeyDown("servers", e)}
            onBlur={() => addTag("servers", serverInput)}
            placeholder={form.servers.length === 0 ? "e.g. partner-*, github-mcp (press Enter)" : ""}
            className="flex-1 min-w-[120px] outline-none text-sm py-0.5"
          />
        </div>
      </div>

      {/* Tool patterns - tag input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tool Patterns
        </label>
        <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg bg-white min-h-[40px]">
          {form.tools.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-sm font-mono"
            >
              {tag}
              <button type="button" onClick={() => removeTag("tools", i)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            value={toolInput}
            onChange={(e) => setToolInput(e.target.value)}
            onKeyDown={(e) => handleKeyDown("tools", e)}
            onBlur={() => addTag("tools", toolInput)}
            placeholder={form.tools.length === 0 ? "e.g. *_delete_*, *_write_* (press Enter)" : ""}
            className="flex-1 min-w-[120px] outline-none text-sm py-0.5"
          />
        </div>
      </div>

      {/* Schedule section */}
      <div className="border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setShowSchedule(!showSchedule)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>Schedule (Time Windows)</span>
          {showSchedule ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {showSchedule && (
          <div className="px-4 pb-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-2">Active on days</label>
              <div className="flex gap-1">
                {dayLabels.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`w-10 h-8 text-xs rounded ${
                      scheduleDays.includes(i)
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Hour (0-23)</label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Hour (0-23)</label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Advanced section */}
      <div className="border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>Advanced Modifiers</span>
          {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {showAdvanced && (
          <div className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Redact PII</span>
                <p className="text-xs text-gray-400">Automatically redact sensitive data in responses</p>
              </div>
              <Switch checked={redactPII} onCheckedChange={setRedactPII} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Rate Limit</span>
                <p className="text-xs text-gray-400">Max calls per minute (0 = unlimited)</p>
              </div>
              <Input
                type="number"
                min={0}
                value={maxCallsPerMinute}
                onChange={(e) => setMaxCallsPerMinute(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-24"
                placeholder="0"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Require MFA</span>
                <p className="text-xs text-gray-400">Require multi-factor authentication</p>
              </div>
              <Switch checked={requireMFA} onCheckedChange={setRequireMFA} />
            </div>
          </div>
        )}
      </div>

      {/* Live preview */}
      {form.name && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <span className="text-xs text-gray-400 block mb-1">Rule Preview</span>
          <p className="text-sm text-gray-700">{getPreview()}</p>
        </div>
      )}

      <Button type="submit" disabled={submitting || !form.name}>
        {submitting ? "Creating..." : "Create Rule"}
      </Button>
    </form>
  );
}
