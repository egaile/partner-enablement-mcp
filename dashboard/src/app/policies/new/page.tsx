"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import RuleBuilder from "@/components/policies/RuleBuilder";
import { gatewayFetch } from "@/lib/api";

export default function NewPolicyPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(rule: Record<string, unknown>) {
    setSubmitting(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch("/api/policies", token, {
        method: "POST",
        body: JSON.stringify(rule),
      });
      router.push("/policies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create policy");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/policies" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-xl font-semibold">Create Policy Rule</h2>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <RuleBuilder onSubmit={handleSubmit} submitting={submitting} />
    </div>
  );
}
