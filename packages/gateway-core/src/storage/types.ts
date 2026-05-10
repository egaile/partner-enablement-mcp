/**
 * StorageBackend — pluggable persistence interface for the gateway hot path.
 *
 * Scoped narrowly to what the proxy + scanner pipeline + audit + drift
 * detection need at request time. Cloud-only CRUD endpoints (billing, team,
 * dashboard) keep their own query modules in apps/cloud-control-plane.
 *
 * Two reference implementations:
 *   - SqliteStorageBackend — OSS default, runs anywhere
 *   - SupabaseStorageBackend — cloud, multi-tenant with RLS
 */

import type { AuditEntry } from "../schemas/index.js";

// === Domain records (storage-agnostic; mirror what the hot-path consumes) ===

export interface PolicyRuleRecord {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  priority: number;
  conditions: {
    servers?: string[];
    tools?: string[];
    users?: string[];
    timeWindows?: Array<{
      daysOfWeek?: number[];
      startHour?: number;
      endHour?: number;
    }>;
  };
  action: "allow" | "deny" | "require_approval" | "log_only";
  modifiers: {
    redactPII?: boolean;
    redactSecrets?: boolean;
    maxCallsPerMinute?: number;
    requireMFA?: boolean;
  } | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ToolSnapshotRecord {
  id: string;
  tenantId: string;
  serverId: string;
  toolName: string;
  definitionHash: string;
  definition: Record<string, unknown>;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface McpServerRecord {
  id: string;
  tenantId: string;
  name: string;
  transport: "stdio" | "http";
  command: string | null;
  args: string[] | null;
  url: string | null;
  env: Record<string, string> | null;
  authHeaders: Record<string, string> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  authType: "static" | "oauth2";
  oauthClientId: string | null;
  oauthClientSecret: string | null;
  oauthRefreshToken: string | null;
  oauthAccessToken: string | null;
  oauthTokenExpiresAt: string | null;
  oauthTokenUrl: string | null;
  oauthAuthorizeUrl: string | null;
  oauthScopes: string[] | null;
  oauthCodeVerifier: string | null;
  oauthStateNonce: string | null;
}

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdBy: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface WebhookRecord {
  id: string;
  tenantId: string;
  url: string;
  /** HMAC-SHA256 signing secret. Stored in plaintext; treat the table as secrets. */
  secret: string;
  /** Event names this webhook subscribes to (e.g. "injection_detected", "tool_drift"). */
  events: string[];
  enabled: boolean;
  createdAt: string;
}

export interface WebhookCreateInput {
  tenantId: string;
  url: string;
  secret: string;
  events: string[];
  enabled?: boolean;
}

/**
 * Persisted shape of an audit log row.
 *
 * Mirrors `AuditEntry` but adds the storage-assigned `id` and `createdAt`
 * so listing endpoints can paginate / sort.
 */
export interface AuditLogRecord extends AuditEntry {
  id: string;
  createdAt: string;
}

export interface AuditListOptions {
  /** Max rows to return. Defaults to 50, hard-cap 1000. */
  limit?: number;
  /** Skip this many rows (for pagination). */
  offset?: number;
  /**
   * If true, only return rows that look like security events:
   * threatsDetected > 0, policyDecision = "deny", or success = false.
   */
  onlyFlagged?: boolean;
  /** ISO 8601 timestamp. Returns rows created strictly after this. */
  afterCreatedAt?: string;
}

export interface TenantRecord {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// === Input types (for upsert from config-as-code) ===

export interface PolicyRuleUpsertInput {
  /** Stable key for upsert. For YAML-defined policies, this is `${tenantId}:${name}`. */
  externalId?: string;
  tenantId: string;
  name: string;
  description?: string;
  priority?: number;
  conditions: PolicyRuleRecord["conditions"];
  action: PolicyRuleRecord["action"];
  modifiers?: PolicyRuleRecord["modifiers"];
  enabled?: boolean;
}

export interface ServerUpsertInput {
  externalId?: string;
  tenantId: string;
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  authHeaders?: Record<string, string>;
  enabled?: boolean;
  authType?: "static" | "oauth2";
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthTokenUrl?: string;
  oauthAuthorizeUrl?: string;
  oauthScopes?: string[];
}

export interface SnapshotUpsertInput {
  tenantId: string;
  serverId: string;
  toolName: string;
  definitionHash: string;
  definition: Record<string, unknown>;
}

// === Backend interface ===

export interface StorageBackend {
  /** Initialize the backend (open connections, run migrations, etc.). */
  init(): Promise<void>;
  /** Close connections, flush pending writes, release resources. */
  close(): Promise<void>;

  tenants: {
    /** Look up a tenant by ID. Returns null if not found. */
    getById(id: string): Promise<TenantRecord | null>;
    /**
     * For OSS single-tenant deployments: get or create the default tenant.
     * Cloud impls may throw if called.
     */
    getOrCreateDefault(): Promise<TenantRecord>;
  };

  policies: {
    /** Hot path: list enabled rules ordered by priority. */
    listEnabledForTenant(tenantId: string): Promise<PolicyRuleRecord[]>;
    /**
     * Idempotent upsert keyed by externalId (or by `${tenantId}:${name}` if
     * not provided). Used by the YAML config loader on hot-reload.
     */
    upsert(input: PolicyRuleUpsertInput): Promise<PolicyRuleRecord>;
    /**
     * Replace all rules matching a sourceTag with the given set. Used by
     * config-as-code to remove stale rules when YAML changes.
     */
    replaceFromConfig(
      tenantId: string,
      rules: PolicyRuleUpsertInput[]
    ): Promise<void>;
  };

  audit: {
    /** Hot path: batch insert. Throws on failure; caller may retry. */
    append(entries: AuditEntry[]): Promise<void>;
    /**
     * Read recent audit entries. Used by the CLI (`audit tail`, `alerts
     * list`) and by self-host introspection.
     *
     * Cloud deployments may throw — the dashboard uses dedicated query
     * routes with richer pagination + filtering.
     */
    list(
      tenantId: string,
      options?: AuditListOptions
    ): Promise<AuditLogRecord[]>;
  };

  snapshots: {
    /** Hot path: lookup current tool snapshot for drift comparison. */
    get(
      tenantId: string,
      serverId: string,
      toolName: string
    ): Promise<ToolSnapshotRecord | null>;
    /** Hot path: write tool snapshot after first observation or approval. */
    upsert(input: SnapshotUpsertInput): Promise<ToolSnapshotRecord>;
  };

  servers: {
    /** Connection manager: enabled servers for a tenant. */
    listEnabledForTenant(tenantId: string): Promise<McpServerRecord[]>;
    /** Lookup by ID. Returns null if not found or wrong tenant. */
    getById(id: string, tenantId: string): Promise<McpServerRecord | null>;
    /** Idempotent upsert from config-as-code. */
    upsert(input: ServerUpsertInput): Promise<McpServerRecord>;
    /** Replace all servers matching a sourceTag with the given set. */
    replaceFromConfig(
      tenantId: string,
      servers: ServerUpsertInput[]
    ): Promise<void>;
    /** Persist OAuth tokens after exchange/refresh. Encrypted at the storage layer. */
    updateOAuthTokens(
      id: string,
      tenantId: string,
      tokens: {
        oauthAccessToken: string | null;
        oauthRefreshToken: string | null;
        oauthTokenExpiresAt: string | null;
      }
    ): Promise<void>;
  };

  apiKeys: {
    /** Auth middleware: lookup by SHA-256 hash. */
    findByHash(keyHash: string): Promise<ApiKeyRecord | null>;
    /** Auth middleware: bump last_used_at after successful auth. */
    updateLastUsed(id: string): Promise<void>;
    /**
     * Persist a freshly minted key. Caller hashes the raw key first
     * (see `generateApiKey()` / `hashApiKey()` in `@mcpshield/gateway-core/auth`).
     * Returns the stored record.
     */
    create(input: ApiKeyCreateInput): Promise<ApiKeyRecord>;
  };

  webhooks: {
    /** Dispatcher: find enabled webhooks subscribed to a given event name. */
    listByEvent(tenantId: string, event: string): Promise<WebhookRecord[]>;
    /** Dispatcher (test deliveries): lookup by id, scoped to tenant. */
    get(id: string, tenantId: string): Promise<WebhookRecord | null>;
    /** Admin (CLI / dashboard): list all webhooks for a tenant. */
    listForTenant(tenantId: string): Promise<WebhookRecord[]>;
    /** Admin: register a new webhook. */
    create(input: WebhookCreateInput): Promise<WebhookRecord>;
    /** Admin: delete a webhook. */
    delete(id: string, tenantId: string): Promise<void>;
  };
}

export interface ApiKeyCreateInput {
  tenantId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdBy: string;
  expiresAt?: string | null;
}

/** Common error thrown by storage backends. */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "StorageError";
  }
}
