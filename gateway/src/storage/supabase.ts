/**
 * SupabaseStorageBackend — cloud implementation of StorageBackend.
 *
 * Thin facade over the existing `db/queries/*` modules so the proxy hot path
 * can speak to a single, version-stable interface no matter which backend is
 * wired up. The underlying queries (with their RLS, multi-tenant scoping,
 * billing-aware columns, etc.) are unchanged.
 *
 * Will move to `apps/cloud-control-plane/src/storage/supabase.ts` when the
 * `apps/` restructure lands; for now it lives alongside the existing gateway
 * code to avoid breaking imports.
 */

import type {
  ApiKeyRecord,
  ApprovalListOptions,
  ApprovalRequestCreateInput,
  ApprovalRequestRecord,
  McpServerRecord,
  PolicyRuleRecord,
  PolicyRuleUpsertInput,
  ServerUpsertInput,
  SnapshotUpsertInput,
  StorageBackend,
  TenantRecord,
  ToolSnapshotRecord,
  WebhookCreateInput,
  WebhookRecord,
} from "@mcpshield/gateway-core/storage";
import { StorageError } from "@mcpshield/gateway-core/storage";
import type { AuditEntry } from "@mcpshield/gateway-core/audit";

import { getApiKeyByHash, updateLastUsed } from "../db/queries/api-keys.js";
import { insertAuditEntries } from "../db/queries/audit.js";
import { getPoliciesForTenant } from "../db/queries/policies.js";
import {
  getEnabledServersForTenant,
  getServerById,
  updateServerOAuthTokens,
} from "../db/queries/servers.js";
import {
  getSnapshot,
  upsertSnapshot,
} from "../db/queries/snapshots.js";
import { getTenantById } from "../db/queries/tenants.js";
import {
  createWebhook,
  deleteWebhook,
  getWebhook,
  getWebhooksByEvent,
  getWebhooksForTenant,
} from "../db/queries/webhooks.js";
import {
  approveRequest,
  createApprovalRequest,
  getApprovalByCorrelation,
  getApprovalRequest,
  getPendingApprovals,
  rejectRequest,
} from "../db/queries/approvals.js";

async function notSupported(op: string): Promise<never> {
  throw new StorageError(
    `${op} is not supported by SupabaseStorageBackend — cloud deployments manage CRUD through dashboard routes, not config-as-code.`
  );
}

export class SupabaseStorageBackend implements StorageBackend {
  async init(): Promise<void> {
    // Supabase client is initialized lazily on first use; nothing to do here.
  }

  async close(): Promise<void> {
    // Supabase client manages its own connection pool; nothing to release.
  }

  tenants = {
    getById: async (id: string): Promise<TenantRecord | null> => {
      const t = await getTenantById(id);
      if (!t) return null;
      return {
        id: t.id,
        name: t.name,
        settings: t.settings ?? {},
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    },

    getOrCreateDefault: async (): Promise<TenantRecord> => {
      throw new StorageError(
        "getOrCreateDefault is not supported by SupabaseStorageBackend — cloud deployments require explicit tenant resolution via Clerk auth."
      );
    },
  };

  policies = {
    listEnabledForTenant: async (
      tenantId: string
    ): Promise<PolicyRuleRecord[]> => {
      // getPoliciesForTenant already filters enabled=true and orders by priority ASC.
      return getPoliciesForTenant(tenantId);
    },

    upsert: async (_input: PolicyRuleUpsertInput): Promise<PolicyRuleRecord> => {
      return notSupported("policies.upsert");
    },

    replaceFromConfig: async (
      _tenantId: string,
      _rules: PolicyRuleUpsertInput[]
    ): Promise<void> => {
      await notSupported("policies.replaceFromConfig");
    },
  };

  audit = {
    append: async (entries: AuditEntry[]): Promise<void> => {
      if (entries.length === 0) return;
      await insertAuditEntries(entries);
    },

    list: async (): Promise<never> => {
      return notSupported("audit.list");
    },
  };

  snapshots = {
    get: async (
      tenantId: string,
      serverId: string,
      toolName: string
    ): Promise<ToolSnapshotRecord | null> => {
      return getSnapshot(tenantId, serverId, toolName);
    },

    upsert: async (
      input: SnapshotUpsertInput
    ): Promise<ToolSnapshotRecord> => {
      return upsertSnapshot(
        input.tenantId,
        input.serverId,
        input.toolName,
        input.definitionHash,
        input.definition
      );
    },
  };

  servers = {
    listEnabledForTenant: async (
      tenantId: string
    ): Promise<McpServerRecord[]> => {
      return getEnabledServersForTenant(tenantId);
    },

    getById: async (
      id: string,
      tenantId: string
    ): Promise<McpServerRecord | null> => {
      return getServerById(id, tenantId);
    },

    upsert: async (_input: ServerUpsertInput): Promise<McpServerRecord> => {
      return notSupported("servers.upsert");
    },

    replaceFromConfig: async (
      _tenantId: string,
      _servers: ServerUpsertInput[]
    ): Promise<void> => {
      await notSupported("servers.replaceFromConfig");
    },

    updateOAuthTokens: async (
      id: string,
      tenantId: string,
      tokens: {
        oauthAccessToken: string | null;
        oauthRefreshToken: string | null;
        oauthTokenExpiresAt: string | null;
      }
    ): Promise<void> => {
      await updateServerOAuthTokens(id, tenantId, tokens);
    },
  };

  apiKeys = {
    findByHash: async (keyHash: string): Promise<ApiKeyRecord | null> => {
      return getApiKeyByHash(keyHash);
    },

    updateLastUsed: async (id: string): Promise<void> => {
      await updateLastUsed(id);
    },

    create: async (): Promise<never> => {
      return notSupported("apiKeys.create");
    },
  };

  webhooks = {
    listByEvent: async (
      tenantId: string,
      event: string
    ): Promise<WebhookRecord[]> => {
      return getWebhooksByEvent(tenantId, event);
    },

    get: async (
      id: string,
      tenantId: string
    ): Promise<WebhookRecord | null> => {
      return getWebhook(id, tenantId);
    },

    listForTenant: async (tenantId: string): Promise<WebhookRecord[]> => {
      return getWebhooksForTenant(tenantId);
    },

    create: async (input: WebhookCreateInput): Promise<WebhookRecord> => {
      return createWebhook(input.tenantId, {
        url: input.url,
        secret: input.secret,
        events: input.events,
        enabled: input.enabled,
      });
    },

    delete: async (id: string, tenantId: string): Promise<void> => {
      await deleteWebhook(id, tenantId);
    },
  };

  approvals = {
    create: async (
      input: ApprovalRequestCreateInput
    ): Promise<ApprovalRequestRecord> => {
      return createApprovalRequest({
        tenantId: input.tenantId,
        correlationId: input.correlationId,
        userId: input.userId,
        serverName: input.serverName,
        toolName: input.toolName,
        params: input.params,
      });
    },

    get: async (
      id: string,
      tenantId: string
    ): Promise<ApprovalRequestRecord | null> => {
      return getApprovalRequest(id, tenantId);
    },

    getByCorrelation: async (
      correlationId: string,
      tenantId: string
    ): Promise<ApprovalRequestRecord | null> => {
      return getApprovalByCorrelation(correlationId, tenantId);
    },

    listPending: async (
      tenantId: string,
      options?: ApprovalListOptions
    ): Promise<{ data: ApprovalRequestRecord[]; count: number }> => {
      return getPendingApprovals(tenantId, options);
    },

    approve: async (
      id: string,
      tenantId: string,
      decidedBy: string
    ): Promise<ApprovalRequestRecord> => {
      return approveRequest(id, tenantId, decidedBy);
    },

    reject: async (
      id: string,
      tenantId: string,
      decidedBy: string
    ): Promise<ApprovalRequestRecord> => {
      return rejectRequest(id, tenantId, decidedBy);
    },
  };
}
