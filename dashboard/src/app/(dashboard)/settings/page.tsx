"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Key, Users, Settings2, Globe, User, CreditCard, ArrowUpRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { gatewayFetch } from "@/lib/api";

interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  key_prefix: string;
  createdBy: string;
  created_by: string;
  lastUsedAt: string | null;
  last_used_at: string | null;
  expiresAt: string | null;
  expires_at: string | null;
  createdAt: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  clerkUserId: string;
  clerk_user_id: string;
  role: string;
  createdAt: string;
  created_at: string;
}

interface BillingUsage {
  plan: {
    id: string;
    name: string;
    maxServers: number;
    maxCallsPerMonth: number;
    priceMonthly: number | null;
  };
  usage: {
    callCount: number;
    blockedCount: number;
    serverCount: number;
  };
  limits: {
    callsUsedPercent: number;
    serversUsedPercent: number;
  };
}

interface PlanDef {
  id: string;
  name: string;
  maxServers: number;
  maxCallsPerMonth: number;
  priceMonthly: number | null;
  features: Record<string, boolean>;
}

export default function SettingsPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "account";

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<ApiKeyRecord | null>(null);

  // Team state
  const [members, setMembers] = useState<TeamMember[]>([]);

  // Billing state
  const [billing, setBilling] = useState<BillingUsage | null>(null);
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [upgrading, setUpgrading] = useState(false);

  const loadApiKeys = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ keys: ApiKeyRecord[] }>(
        "/api/settings/api-keys",
        token
      );
      setApiKeys(data.keys);
    } catch {
      // silently fail
    }
  }, [getToken]);

  const loadTeam = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ members: TeamMember[] }>(
        "/api/settings/team",
        token
      );
      setMembers(data.members);
    } catch {
      // silently fail
    }
  }, [getToken]);

  const loadBilling = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [usageData, plansData] = await Promise.all([
        gatewayFetch<BillingUsage>("/api/billing/usage", token),
        gatewayFetch<{ plans: PlanDef[] }>("/api/billing/plans", token),
      ]);
      setBilling(usageData);
      setPlans(plansData.plans);
    } catch {
      // silently fail
    }
  }, [getToken]);

  useEffect(() => {
    loadApiKeys();
    loadTeam();
    loadBilling();
  }, [loadApiKeys, loadTeam, loadBilling]);

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ key: string; record: ApiKeyRecord }>(
        "/api/settings/api-keys",
        token,
        { method: "POST", body: JSON.stringify({ name: newKeyName }) }
      );
      setNewKeyValue(data.key);
      setNewKeyName("");
      await loadApiKeys();
      toast.success("API key created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleDeleteKey() {
    if (!deleteKeyTarget) return;
    try {
      const token = await getToken();
      if (!token) return;
      await gatewayFetch(`/api/settings/api-keys/${deleteKeyTarget.id}`, token, {
        method: "DELETE",
      });
      setApiKeys(apiKeys.filter((k) => k.id !== deleteKeyTarget.id));
      toast.success("API key revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke key");
    } finally {
      setDeleteKeyTarget(null);
    }
  }

  async function handleUpgrade(planId: string) {
    setUpgrading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ url: string }>(
        "/api/billing/checkout",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            planId,
            successUrl: `${window.location.origin}/settings?tab=billing&success=1`,
            cancelUrl: `${window.location.origin}/settings?tab=billing`,
          }),
        }
      );
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start upgrade");
    } finally {
      setUpgrading(false);
    }
  }

  async function handleManageBilling() {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await gatewayFetch<{ url: string }>(
        "/api/billing/portal",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            returnUrl: `${window.location.origin}/settings?tab=billing`,
          }),
        }
      );
      window.location.href = data.url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to open billing portal"
      );
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_API_URL || "http://localhost:4000";

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-semibold text-foreground">Settings</h2>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="account" className="text-xs">
            <User className="w-3.5 h-3.5 mr-1" /> Account
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs">
            <Users className="w-3.5 h-3.5 mr-1" /> Team
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="text-xs">
            <Key className="w-3.5 h-3.5 mr-1" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="billing" className="text-xs">
            <CreditCard className="w-3.5 h-3.5 mr-1" /> Billing
          </TabsTrigger>
          <TabsTrigger value="gateway" className="text-xs">
            <Globe className="w-3.5 h-3.5 mr-1" /> Gateway
          </TabsTrigger>
          <TabsTrigger value="general" className="text-xs">
            <Settings2 className="w-3.5 h-3.5 mr-1" /> General
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="font-medium text-foreground">Account</h3>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="text-foreground">{user?.primaryEmailAddress?.emailAddress ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="font-mono text-xs text-foreground">{user?.id ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="font-medium text-foreground">Team Members</h3>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team members found.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-sm font-mono text-foreground">
                        {m.clerkUserId || m.clerk_user_id}
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {m.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="font-medium text-foreground">API Keys</h3>
            <p className="text-sm text-muted-foreground">
              Use API keys for programmatic access to the gateway REST API.
            </p>

            {newKeyValue && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-xs text-emerald-400 mb-1 font-medium">
                  New API key created. Copy it now — it won&apos;t be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded border border-border flex-1 font-mono text-foreground">
                    {newKeyValue}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(newKeyValue)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Key name (e.g. CI/CD pipeline)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()}>
                <Plus className="w-4 h-4 mr-1" />
                {creatingKey ? "Creating..." : "Create Key"}
              </Button>
            </div>

            <Separator />

            {apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">No API keys created yet.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {apiKeys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-sm font-medium text-foreground">{k.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-xs text-muted-foreground">
                          {k.keyPrefix || k.key_prefix}...
                        </code>
                        {(k.lastUsedAt || k.last_used_at) && (
                          <span className="text-xs text-muted-foreground">
                            Last used: {new Date(k.lastUsedAt || k.last_used_at!).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => setDeleteKeyTarget(k)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <div className="space-y-4">
            {/* Current plan + usage */}
            {billing && (
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">Current Plan</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className={
                          billing.plan.id === "starter"
                            ? "bg-muted"
                            : billing.plan.id === "pro"
                              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                              : billing.plan.id === "business"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }
                      >
                        {billing.plan.name}
                      </Badge>
                      {billing.plan.priceMonthly !== null && billing.plan.priceMonthly > 0 && (
                        <span className="text-sm text-muted-foreground">
                          ${billing.plan.priceMonthly}/mo
                        </span>
                      )}
                    </div>
                  </div>
                  {billing.plan.id !== "starter" && (
                    <Button variant="outline" size="sm" onClick={handleManageBilling}>
                      Manage Subscription
                      <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Usage bars */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">API Calls</span>
                      <span className="text-foreground">
                        {billing.usage.callCount.toLocaleString()} /{" "}
                        {billing.plan.maxCallsPerMonth === Infinity
                          ? "Unlimited"
                          : billing.plan.maxCallsPerMonth.toLocaleString()}
                      </span>
                    </div>
                    {billing.plan.maxCallsPerMonth !== Infinity && (
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            billing.limits.callsUsedPercent >= 100
                              ? "bg-red-500"
                              : billing.limits.callsUsedPercent >= 80
                                ? "bg-amber-500"
                                : "bg-cyan-500"
                          }`}
                          style={{
                            width: `${Math.min(billing.limits.callsUsedPercent, 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Servers</span>
                      <span className="text-foreground">
                        {billing.usage.serverCount} /{" "}
                        {billing.plan.maxServers === Infinity
                          ? "Unlimited"
                          : billing.plan.maxServers}
                      </span>
                    </div>
                    {billing.plan.maxServers !== Infinity && (
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            billing.limits.serversUsedPercent >= 100
                              ? "bg-red-500"
                              : "bg-cyan-500"
                          }`}
                          style={{
                            width: `${Math.min(billing.limits.serversUsedPercent, 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Plan comparison */}
            {plans.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <h3 className="font-medium text-foreground">Available Plans</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`rounded-lg border p-4 space-y-2 ${
                        billing?.plan.id === plan.id
                          ? "border-cyan-500 bg-cyan-500/5"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-foreground">{plan.name}</h4>
                        {billing?.plan.id === plan.id && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        {plan.priceMonthly === null
                          ? "Custom"
                          : plan.priceMonthly === 0
                            ? "Free"
                            : `$${plan.priceMonthly}/mo`}
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>
                          {plan.maxServers === Infinity ? "Unlimited" : plan.maxServers} server
                          {plan.maxServers !== 1 ? "s" : ""}
                        </li>
                        <li>
                          {plan.maxCallsPerMonth === Infinity
                            ? "Unlimited"
                            : plan.maxCallsPerMonth.toLocaleString()}{" "}
                          calls/month
                        </li>
                      </ul>
                      {billing?.plan.id !== plan.id &&
                        plan.priceMonthly !== null &&
                        plan.priceMonthly > 0 && (
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={upgrading}
                          >
                            {upgrading ? "Redirecting..." : "Upgrade"}
                          </Button>
                        )}
                      {plan.priceMonthly === null && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Contact sales for custom pricing
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Gateway Tab */}
        <TabsContent value="gateway">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="font-medium text-foreground">Gateway Connection</h3>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Gateway URL</dt>
                <dd className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded text-foreground">{GATEWAY_URL}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(GATEWAY_URL)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">MCP Proxy</dt>
                <dd className="font-mono text-xs text-foreground">{GATEWAY_URL}/mcp</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Health Check</dt>
                <dd className="font-mono text-xs text-foreground">{GATEWAY_URL}/health</dd>
              </div>
            </dl>
          </div>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="font-medium text-foreground">General Settings</h3>
            <p className="text-sm text-muted-foreground">
              Advanced gateway settings are managed via environment variables.
              See the deployment documentation for configuration options.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteKeyTarget}
        onOpenChange={(open) => !open && setDeleteKeyTarget(null)}
        title="Revoke API Key"
        description={`Revoke "${deleteKeyTarget?.name}"? Any integrations using this key will stop working immediately.`}
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleDeleteKey}
      />
    </div>
  );
}
