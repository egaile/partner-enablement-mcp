"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Key, Users, Settings2, Globe, User } from "lucide-react";
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

export default function SettingsPage() {
  const { user } = useUser();
  const { getToken } = useAuth();

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<ApiKeyRecord | null>(null);

  // Team state
  const [members, setMembers] = useState<TeamMember[]>([]);

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

  useEffect(() => {
    loadApiKeys();
    loadTeam();
  }, [loadApiKeys, loadTeam]);

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

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_API_URL || "http://localhost:4000";

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>

      <Tabs defaultValue="account">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="account" className="text-xs">
            <User className="w-3.5 h-3.5 mr-1" /> Account
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs">
            <Users className="w-3.5 h-3.5 mr-1" /> Team
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="text-xs">
            <Key className="w-3.5 h-3.5 mr-1" /> API Keys
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
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h3 className="font-medium">Account</h3>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd>{user?.primaryEmailAddress?.emailAddress ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">User ID</dt>
                <dd className="font-mono text-xs">{user?.id ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h3 className="font-medium">Team Members</h3>
            {members.length === 0 ? (
              <p className="text-sm text-gray-400">No team members found.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-sm font-mono">
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
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h3 className="font-medium">API Keys</h3>
            <p className="text-sm text-gray-500">
              Use API keys for programmatic access to the gateway REST API.
            </p>

            {newKeyValue && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-700 mb-1 font-medium">
                  New API key created. Copy it now — it won&apos;t be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-white px-2 py-1 rounded border flex-1 font-mono">
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
              <p className="text-sm text-gray-400">No API keys created yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {apiKeys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-sm font-medium">{k.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-xs text-gray-400">
                          {k.keyPrefix || k.key_prefix}...
                        </code>
                        {(k.lastUsedAt || k.last_used_at) && (
                          <span className="text-xs text-gray-400">
                            Last used: {new Date(k.lastUsedAt || k.last_used_at!).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
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

        {/* Gateway Tab */}
        <TabsContent value="gateway">
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h3 className="font-medium">Gateway Connection</h3>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between items-center">
                <dt className="text-gray-500">Gateway URL</dt>
                <dd className="flex items-center gap-2">
                  <code className="text-xs bg-gray-50 px-2 py-1 rounded">{GATEWAY_URL}</code>
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
                <dt className="text-gray-500">MCP Proxy</dt>
                <dd className="font-mono text-xs">{GATEWAY_URL}/mcp</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Health Check</dt>
                <dd className="font-mono text-xs">{GATEWAY_URL}/health</dd>
              </div>
            </dl>
          </div>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general">
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h3 className="font-medium">General Settings</h3>
            <p className="text-sm text-gray-500">
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
