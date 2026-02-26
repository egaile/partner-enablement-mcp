"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import RuleBuilder from "@/components/policies/RuleBuilder";
import { gatewayFetch } from "@/lib/api";

export default function NewPolicyPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleSubmit(rule: any) {
    setSubmitting(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch("/api/policies", token, {
        method: "POST",
        body: JSON.stringify(rule),
      });
      toast.success("Policy created successfully");
      router.push("/policies");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create policy";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/policies" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-xl font-semibold text-foreground">Create Policy Rule</h2>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <RuleBuilder onSubmit={handleSubmit} submitting={submitting} />
    </div>
  );
}
