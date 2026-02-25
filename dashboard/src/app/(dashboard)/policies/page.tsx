"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, Shield, Trash2 } from "lucide-react";
import { gatewayFetch } from "@/lib/api";

interface PolicyRecord {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  action: string;
  conditions: Record<string, unknown>;
  enabled: boolean;
}

export default function PoliciesPage() {
  const { getToken } = useAuth();
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPolicies() {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ policies: PolicyRecord[] }>(
        "/api/policies",
        token
      );
      setPolicies(data.policies);
    } catch (err) {
      console.error("Failed to load policies:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this policy rule?")) return;
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/policies/${id}`, token, { method: "DELETE" });
      setPolicies(policies.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  const actionBadge = (action: string) => {
    switch (action) {
      case "allow":
        return "bg-green-100 text-green-700";
      case "deny":
        return "bg-red-100 text-red-700";
      case "require_approval":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Policy Rules</h2>
        <Link
          href="/policies/new"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Create Rule
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading policies...</div>
      ) : policies.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No policy rules configured.</p>
          <p className="text-sm mt-1">
            All requests are allowed by default.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {policies.map((p) => (
            <div
              key={p.id}
              className="px-5 py-4 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-mono w-8">
                    #{p.priority}
                  </span>
                  <span className="text-sm font-medium">{p.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${actionBadge(p.action)}`}
                  >
                    {p.action}
                  </span>
                </div>
                {p.description && (
                  <p className="text-xs text-gray-400 mt-1 ml-11">
                    {p.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="text-gray-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
