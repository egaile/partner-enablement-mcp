/**
 * SqliteStorageBackend — OSS default implementation of StorageBackend.
 *
 * Uses better-sqlite3 (synchronous, fast). Wraps every method in async to
 * conform to the interface; the synchronous nature is an implementation
 * detail.
 *
 * Schema is bootstrapped on init() — no separate migration tool needed for
 * the OSS path.
 */

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AuditEntry } from "../schemas/index.js";
import {
  StorageError,
  type ApiKeyRecord,
  type McpServerRecord,
  type PolicyRuleRecord,
  type PolicyRuleUpsertInput,
  type ServerUpsertInput,
  type SnapshotUpsertInput,
  type StorageBackend,
  type TenantRecord,
  type ToolSnapshotRecord,
} from "./types.js";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_TENANT_NAME = "default";

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  default_policy_action TEXT NOT NULL DEFAULT 'allow',
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport IN ('stdio', 'http')),
  command TEXT,
  args TEXT,
  url TEXT,
  env TEXT,
  auth_headers TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'static' CHECK (auth_type IN ('static', 'oauth2')),
  oauth_client_id TEXT,
  oauth_client_secret TEXT,
  oauth_refresh_token TEXT,
  oauth_access_token TEXT,
  oauth_token_expires_at TEXT,
  oauth_token_url TEXT,
  oauth_authorize_url TEXT,
  oauth_scopes TEXT,
  oauth_code_verifier TEXT,
  oauth_state_nonce TEXT,
  external_id TEXT,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_tenant ON mcp_servers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_external ON mcp_servers(tenant_id, external_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_state_nonce ON mcp_servers(oauth_state_nonce) WHERE oauth_state_nonce IS NOT NULL;

CREATE TABLE IF NOT EXISTS tool_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  definition_hash TEXT NOT NULL,
  definition TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, server_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_tool_snapshots_server ON tool_snapshots(server_id);

CREATE TABLE IF NOT EXISTS policy_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  priority INTEGER NOT NULL DEFAULT 1000,
  conditions TEXT NOT NULL DEFAULT '{}',
  action TEXT NOT NULL CHECK (action IN ('allow', 'deny', 'require_approval', 'log_only')),
  modifiers TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  external_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_policy_rules_tenant ON policy_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_priority ON policy_rules(tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_policy_rules_external ON policy_rules(tenant_id, external_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT,
  server_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  policy_decision TEXT NOT NULL,
  policy_rule_id TEXT,
  threats_detected INTEGER NOT NULL DEFAULT 0,
  threat_details TEXT,
  drift_detected INTEGER NOT NULL DEFAULT 0,
  latency_ms REAL NOT NULL DEFAULT 0,
  request_pii_detected INTEGER NOT NULL DEFAULT 0,
  response_pii_detected INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  data_classification TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_server ON audit_logs(tenant_id, server_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tool ON audit_logs(tenant_id, tool_name);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_by TEXT NOT NULL,
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
`;

// === Helpers ===

function nowIso(): string {
  return new Date().toISOString();
}

function jsonOrNull<T>(value: string | null | undefined): T | null {
  if (value == null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function jsonOrEmpty<T>(value: string | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function boolFromInt(v: unknown): boolean {
  return v === 1 || v === true;
}

// === Row mappers ===

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  default_policy_action: string;
  settings: string;
  created_at: string;
  updated_at: string;
}

function mapTenant(row: TenantRow): TenantRecord {
  return {
    id: row.id,
    name: row.name,
    settings: jsonOrEmpty(row.settings, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface PolicyRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  priority: number;
  conditions: string;
  action: PolicyRuleRecord["action"];
  modifiers: string | null;
  enabled: number;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapPolicy(row: PolicyRow): PolicyRuleRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    priority: row.priority,
    conditions: jsonOrEmpty(row.conditions, {}),
    action: row.action,
    modifiers: jsonOrNull<PolicyRuleRecord["modifiers"]>(row.modifiers) as
      | PolicyRuleRecord["modifiers"]
      | null,
    enabled: boolFromInt(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface SnapshotRow {
  id: string;
  tenant_id: string;
  server_id: string;
  tool_name: string;
  definition_hash: string;
  definition: string;
  approved: number;
  created_at: string;
  updated_at: string;
}

function mapSnapshot(row: SnapshotRow): ToolSnapshotRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    serverId: row.server_id,
    toolName: row.tool_name,
    definitionHash: row.definition_hash,
    definition: jsonOrEmpty<Record<string, unknown>>(row.definition, {}),
    approved: boolFromInt(row.approved),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ServerRow {
  id: string;
  tenant_id: string;
  name: string;
  transport: "stdio" | "http";
  command: string | null;
  args: string | null;
  url: string | null;
  env: string | null;
  auth_headers: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
  auth_type: "static" | "oauth2";
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
  oauth_refresh_token: string | null;
  oauth_access_token: string | null;
  oauth_token_expires_at: string | null;
  oauth_token_url: string | null;
  oauth_authorize_url: string | null;
  oauth_scopes: string | null;
  oauth_code_verifier: string | null;
  oauth_state_nonce: string | null;
  external_id: string | null;
}

function mapServer(row: ServerRow): McpServerRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    transport: row.transport,
    command: row.command,
    args: jsonOrNull<string[]>(row.args),
    url: row.url,
    env: jsonOrNull<Record<string, string>>(row.env),
    authHeaders: jsonOrNull<Record<string, string>>(row.auth_headers),
    enabled: boolFromInt(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authType: row.auth_type,
    oauthClientId: row.oauth_client_id,
    oauthClientSecret: row.oauth_client_secret,
    oauthRefreshToken: row.oauth_refresh_token,
    oauthAccessToken: row.oauth_access_token,
    oauthTokenExpiresAt: row.oauth_token_expires_at,
    oauthTokenUrl: row.oauth_token_url,
    oauthAuthorizeUrl: row.oauth_authorize_url,
    oauthScopes: jsonOrNull<string[]>(row.oauth_scopes),
    oauthCodeVerifier: row.oauth_code_verifier,
    oauthStateNonce: row.oauth_state_nonce,
  };
}

interface ApiKeyRow {
  id: string;
  tenant_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  created_by: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

function mapApiKey(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    keyHash: row.key_hash,
    keyPrefix: row.key_prefix,
    createdBy: row.created_by,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// === Backend ===

export interface SqliteOptions {
  /** Path to SQLite database file. Use ":memory:" for ephemeral. */
  path: string;
  /** Default tenant ID for OSS single-tenant deployments. */
  defaultTenantId?: string;
  /** Default tenant name. Used when bootstrapping. */
  defaultTenantName?: string;
}

export class SqliteStorageBackend implements StorageBackend {
  private db: Database.Database | null = null;
  private readonly path: string;
  private readonly defaultTenantId: string;
  private readonly defaultTenantName: string;

  constructor(options: SqliteOptions) {
    this.path = options.path;
    this.defaultTenantId = options.defaultTenantId ?? DEFAULT_TENANT_ID;
    this.defaultTenantName = options.defaultTenantName ?? DEFAULT_TENANT_NAME;
  }

  async init(): Promise<void> {
    if (this.path !== ":memory:") {
      const dir = dirname(this.path);
      if (dir && dir !== ".") {
        try {
          mkdirSync(dir, { recursive: true });
        } catch (err) {
          throw new StorageError(`Failed to create db directory ${dir}`, err);
        }
      }
    }
    this.db = new Database(this.path);
    this.db.exec(SCHEMA_SQL);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private requireDb(): Database.Database {
    if (!this.db) {
      throw new StorageError("Storage backend not initialized; call init() first");
    }
    return this.db;
  }

  // --- tenants ---

  tenants = {
    getById: async (id: string): Promise<TenantRecord | null> => {
      const row = this.requireDb()
        .prepare<[string], TenantRow>("SELECT * FROM tenants WHERE id = ?")
        .get(id);
      return row ? mapTenant(row) : null;
    },

    getOrCreateDefault: async (): Promise<TenantRecord> => {
      const db = this.requireDb();
      const existing = db
        .prepare<[string], TenantRow>("SELECT * FROM tenants WHERE id = ?")
        .get(this.defaultTenantId);
      if (existing) return mapTenant(existing);

      const now = nowIso();
      db.prepare(
        `INSERT INTO tenants (id, name, slug, default_policy_action, settings, created_at, updated_at)
         VALUES (?, ?, ?, 'allow', '{}', ?, ?)`
      ).run(this.defaultTenantId, this.defaultTenantName, "default", now, now);

      const created = db
        .prepare<[string], TenantRow>("SELECT * FROM tenants WHERE id = ?")
        .get(this.defaultTenantId);
      if (!created) throw new StorageError("Failed to bootstrap default tenant");
      return mapTenant(created);
    },
  };

  // --- policies ---

  policies = {
    listEnabledForTenant: async (
      tenantId: string
    ): Promise<PolicyRuleRecord[]> => {
      const rows = this.requireDb()
        .prepare<[string], PolicyRow>(
          `SELECT * FROM policy_rules
           WHERE tenant_id = ? AND enabled = 1
           ORDER BY priority ASC`
        )
        .all(tenantId);
      return rows.map(mapPolicy);
    },

    upsert: async (
      input: PolicyRuleUpsertInput
    ): Promise<PolicyRuleRecord> => {
      const db = this.requireDb();
      const externalId = input.externalId ?? `${input.tenantId}:${input.name}`;
      const now = nowIso();
      const conditions = JSON.stringify(input.conditions);
      const modifiers = input.modifiers ? JSON.stringify(input.modifiers) : null;

      const existing = db
        .prepare<[string, string], PolicyRow>(
          `SELECT * FROM policy_rules WHERE tenant_id = ? AND external_id = ?`
        )
        .get(input.tenantId, externalId);

      if (existing) {
        db.prepare(
          `UPDATE policy_rules SET
             name = ?, description = ?, priority = ?, conditions = ?,
             action = ?, modifiers = ?, enabled = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          input.name,
          input.description ?? null,
          input.priority ?? 1000,
          conditions,
          input.action,
          modifiers,
          input.enabled === false ? 0 : 1,
          now,
          existing.id
        );
        const updated = db
          .prepare<[string], PolicyRow>("SELECT * FROM policy_rules WHERE id = ?")
          .get(existing.id);
        if (!updated) throw new StorageError("Policy upsert returned no row");
        return mapPolicy(updated);
      }

      const id = randomUUID();
      db.prepare(
        `INSERT INTO policy_rules
           (id, tenant_id, name, description, priority, conditions, action, modifiers, enabled, external_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.tenantId,
        input.name,
        input.description ?? null,
        input.priority ?? 1000,
        conditions,
        input.action,
        modifiers,
        input.enabled === false ? 0 : 1,
        externalId,
        now,
        now
      );
      const created = db
        .prepare<[string], PolicyRow>("SELECT * FROM policy_rules WHERE id = ?")
        .get(id);
      if (!created) throw new StorageError("Policy insert returned no row");
      return mapPolicy(created);
    },

    replaceFromConfig: async (
      tenantId: string,
      rules: PolicyRuleUpsertInput[]
    ): Promise<void> => {
      const db = this.requireDb();
      const externalIds = new Set(
        rules.map((r) => r.externalId ?? `${tenantId}:${r.name}`)
      );

      const txn = db.transaction(() => {
        // Upsert all incoming rules
        for (const rule of rules) {
          const externalId = rule.externalId ?? `${tenantId}:${rule.name}`;
          const now = nowIso();
          const conditions = JSON.stringify(rule.conditions);
          const modifiers = rule.modifiers ? JSON.stringify(rule.modifiers) : null;
          const existing = db
            .prepare<[string, string], { id: string }>(
              `SELECT id FROM policy_rules WHERE tenant_id = ? AND external_id = ?`
            )
            .get(tenantId, externalId);
          if (existing) {
            db.prepare(
              `UPDATE policy_rules SET
                 name = ?, description = ?, priority = ?, conditions = ?,
                 action = ?, modifiers = ?, enabled = ?, updated_at = ?
               WHERE id = ?`
            ).run(
              rule.name,
              rule.description ?? null,
              rule.priority ?? 1000,
              conditions,
              rule.action,
              modifiers,
              rule.enabled === false ? 0 : 1,
              now,
              existing.id
            );
          } else {
            db.prepare(
              `INSERT INTO policy_rules
                 (id, tenant_id, name, description, priority, conditions, action, modifiers, enabled, external_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              randomUUID(),
              tenantId,
              rule.name,
              rule.description ?? null,
              rule.priority ?? 1000,
              conditions,
              rule.action,
              modifiers,
              rule.enabled === false ? 0 : 1,
              externalId,
              now,
              now
            );
          }
        }

        // Delete config-managed rules no longer in the input
        const stale = db
          .prepare<[string], { id: string; external_id: string }>(
            `SELECT id, external_id FROM policy_rules
             WHERE tenant_id = ? AND external_id IS NOT NULL`
          )
          .all(tenantId);
        const deleteStmt = db.prepare(
          `DELETE FROM policy_rules WHERE id = ?`
        );
        for (const row of stale) {
          if (!externalIds.has(row.external_id)) {
            deleteStmt.run(row.id);
          }
        }
      });
      txn();
    },
  };

  // --- audit ---

  audit = {
    append: async (entries: AuditEntry[]): Promise<void> => {
      if (entries.length === 0) return;
      const db = this.requireDb();
      const now = nowIso();
      const stmt = db.prepare(
        `INSERT INTO audit_logs
           (id, correlation_id, tenant_id, user_id, server_id, server_name,
            tool_name, policy_decision, policy_rule_id, threats_detected,
            threat_details, drift_detected, latency_ms, request_pii_detected,
            response_pii_detected, success, error_message, data_classification, created_at)
         VALUES
           (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const txn = db.transaction((rows: AuditEntry[]) => {
        for (const e of rows) {
          stmt.run(
            randomUUID(),
            e.correlationId,
            e.tenantId,
            e.userId ?? null,
            e.serverId,
            e.serverName,
            e.toolName,
            e.policyDecision,
            e.policyRuleId ?? null,
            e.threatsDetected ?? 0,
            e.threatDetails ? JSON.stringify(e.threatDetails) : null,
            e.driftDetected ? 1 : 0,
            e.latencyMs,
            e.requestPiiDetected ? 1 : 0,
            e.responsePiiDetected ? 1 : 0,
            e.success ? 1 : 0,
            e.errorMessage ?? null,
            e.dataClassification ?? null,
            now
          );
        }
      });

      try {
        txn(entries);
      } catch (err) {
        throw new StorageError("Audit append failed", err);
      }
    },
  };

  // --- snapshots ---

  snapshots = {
    get: async (
      tenantId: string,
      serverId: string,
      toolName: string
    ): Promise<ToolSnapshotRecord | null> => {
      const row = this.requireDb()
        .prepare<[string, string, string], SnapshotRow>(
          `SELECT * FROM tool_snapshots
           WHERE tenant_id = ? AND server_id = ? AND tool_name = ?`
        )
        .get(tenantId, serverId, toolName);
      return row ? mapSnapshot(row) : null;
    },

    upsert: async (
      input: SnapshotUpsertInput
    ): Promise<ToolSnapshotRecord> => {
      const db = this.requireDb();
      const now = nowIso();
      const definition = JSON.stringify(input.definition);

      const existing = db
        .prepare<[string, string, string], SnapshotRow>(
          `SELECT * FROM tool_snapshots
           WHERE tenant_id = ? AND server_id = ? AND tool_name = ?`
        )
        .get(input.tenantId, input.serverId, input.toolName);

      if (existing) {
        db.prepare(
          `UPDATE tool_snapshots SET
             definition_hash = ?, definition = ?, approved = 1, updated_at = ?
           WHERE id = ?`
        ).run(input.definitionHash, definition, now, existing.id);
        const updated = db
          .prepare<[string], SnapshotRow>(
            "SELECT * FROM tool_snapshots WHERE id = ?"
          )
          .get(existing.id);
        if (!updated) throw new StorageError("Snapshot upsert returned no row");
        return mapSnapshot(updated);
      }

      const id = randomUUID();
      db.prepare(
        `INSERT INTO tool_snapshots
           (id, tenant_id, server_id, tool_name, definition_hash, definition, approved, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).run(
        id,
        input.tenantId,
        input.serverId,
        input.toolName,
        input.definitionHash,
        definition,
        now,
        now
      );
      const created = db
        .prepare<[string], SnapshotRow>(
          "SELECT * FROM tool_snapshots WHERE id = ?"
        )
        .get(id);
      if (!created) throw new StorageError("Snapshot insert returned no row");
      return mapSnapshot(created);
    },
  };

  // --- servers ---

  servers = {
    listEnabledForTenant: async (
      tenantId: string
    ): Promise<McpServerRecord[]> => {
      const rows = this.requireDb()
        .prepare<[string], ServerRow>(
          `SELECT * FROM mcp_servers
           WHERE tenant_id = ? AND enabled = 1
           ORDER BY name`
        )
        .all(tenantId);
      return rows.map(mapServer);
    },

    getById: async (
      id: string,
      tenantId: string
    ): Promise<McpServerRecord | null> => {
      const row = this.requireDb()
        .prepare<[string, string], ServerRow>(
          `SELECT * FROM mcp_servers WHERE id = ? AND tenant_id = ?`
        )
        .get(id, tenantId);
      return row ? mapServer(row) : null;
    },

    upsert: async (input: ServerUpsertInput): Promise<McpServerRecord> => {
      const db = this.requireDb();
      const externalId = input.externalId ?? `${input.tenantId}:${input.name}`;
      const now = nowIso();

      const existing = db
        .prepare<[string, string], ServerRow>(
          `SELECT * FROM mcp_servers WHERE tenant_id = ? AND external_id = ?`
        )
        .get(input.tenantId, externalId);

      if (existing) {
        db.prepare(
          `UPDATE mcp_servers SET
             name = ?, transport = ?, command = ?, args = ?, url = ?,
             env = ?, auth_headers = ?, enabled = ?, auth_type = ?,
             oauth_client_id = COALESCE(?, oauth_client_id),
             oauth_client_secret = COALESCE(?, oauth_client_secret),
             oauth_token_url = COALESCE(?, oauth_token_url),
             oauth_authorize_url = COALESCE(?, oauth_authorize_url),
             oauth_scopes = COALESCE(?, oauth_scopes),
             updated_at = ?
           WHERE id = ?`
        ).run(
          input.name,
          input.transport,
          input.command ?? null,
          input.args ? JSON.stringify(input.args) : null,
          input.url ?? null,
          input.env ? JSON.stringify(input.env) : null,
          input.authHeaders ? JSON.stringify(input.authHeaders) : null,
          input.enabled === false ? 0 : 1,
          input.authType ?? "static",
          input.oauthClientId ?? null,
          input.oauthClientSecret ?? null,
          input.oauthTokenUrl ?? null,
          input.oauthAuthorizeUrl ?? null,
          input.oauthScopes ? JSON.stringify(input.oauthScopes) : null,
          now,
          existing.id
        );
        const updated = db
          .prepare<[string], ServerRow>("SELECT * FROM mcp_servers WHERE id = ?")
          .get(existing.id);
        if (!updated) throw new StorageError("Server upsert returned no row");
        return mapServer(updated);
      }

      const id = randomUUID();
      db.prepare(
        `INSERT INTO mcp_servers
           (id, tenant_id, name, transport, command, args, url, env, auth_headers,
            enabled, created_at, updated_at, auth_type, oauth_client_id,
            oauth_client_secret, oauth_token_url, oauth_authorize_url, oauth_scopes,
            external_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.tenantId,
        input.name,
        input.transport,
        input.command ?? null,
        input.args ? JSON.stringify(input.args) : null,
        input.url ?? null,
        input.env ? JSON.stringify(input.env) : null,
        input.authHeaders ? JSON.stringify(input.authHeaders) : null,
        input.enabled === false ? 0 : 1,
        now,
        now,
        input.authType ?? "static",
        input.oauthClientId ?? null,
        input.oauthClientSecret ?? null,
        input.oauthTokenUrl ?? null,
        input.oauthAuthorizeUrl ?? null,
        input.oauthScopes ? JSON.stringify(input.oauthScopes) : null,
        externalId
      );
      const created = db
        .prepare<[string], ServerRow>("SELECT * FROM mcp_servers WHERE id = ?")
        .get(id);
      if (!created) throw new StorageError("Server insert returned no row");
      return mapServer(created);
    },

    replaceFromConfig: async (
      tenantId: string,
      servers: ServerUpsertInput[]
    ): Promise<void> => {
      const db = this.requireDb();
      const externalIds = new Set(
        servers.map((s) => s.externalId ?? `${tenantId}:${s.name}`)
      );

      const txn = db.transaction(() => {
        for (const server of servers) {
          // Reuse upsert logic inline (can't await across prepared stmt boundary cleanly).
          const externalId = server.externalId ?? `${tenantId}:${server.name}`;
          const now = nowIso();
          const existing = db
            .prepare<[string, string], { id: string }>(
              `SELECT id FROM mcp_servers WHERE tenant_id = ? AND external_id = ?`
            )
            .get(tenantId, externalId);
          if (existing) {
            db.prepare(
              `UPDATE mcp_servers SET
                 name = ?, transport = ?, command = ?, args = ?, url = ?,
                 env = ?, auth_headers = ?, enabled = ?, auth_type = ?,
                 updated_at = ?
               WHERE id = ?`
            ).run(
              server.name,
              server.transport,
              server.command ?? null,
              server.args ? JSON.stringify(server.args) : null,
              server.url ?? null,
              server.env ? JSON.stringify(server.env) : null,
              server.authHeaders ? JSON.stringify(server.authHeaders) : null,
              server.enabled === false ? 0 : 1,
              server.authType ?? "static",
              now,
              existing.id
            );
          } else {
            db.prepare(
              `INSERT INTO mcp_servers
                 (id, tenant_id, name, transport, command, args, url, env, auth_headers,
                  enabled, created_at, updated_at, auth_type, external_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              randomUUID(),
              tenantId,
              server.name,
              server.transport,
              server.command ?? null,
              server.args ? JSON.stringify(server.args) : null,
              server.url ?? null,
              server.env ? JSON.stringify(server.env) : null,
              server.authHeaders ? JSON.stringify(server.authHeaders) : null,
              server.enabled === false ? 0 : 1,
              now,
              now,
              server.authType ?? "static",
              externalId
            );
          }
        }

        const stale = db
          .prepare<[string], { id: string; external_id: string }>(
            `SELECT id, external_id FROM mcp_servers
             WHERE tenant_id = ? AND external_id IS NOT NULL`
          )
          .all(tenantId);
        const deleteStmt = db.prepare(`DELETE FROM mcp_servers WHERE id = ?`);
        for (const row of stale) {
          if (!externalIds.has(row.external_id)) {
            deleteStmt.run(row.id);
          }
        }
      });
      txn();
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
      this.requireDb()
        .prepare(
          `UPDATE mcp_servers SET
             oauth_access_token = ?, oauth_refresh_token = ?, oauth_token_expires_at = ?,
             updated_at = ?
           WHERE id = ? AND tenant_id = ?`
        )
        .run(
          tokens.oauthAccessToken,
          tokens.oauthRefreshToken,
          tokens.oauthTokenExpiresAt,
          nowIso(),
          id,
          tenantId
        );
    },
  };

  // --- api keys ---

  apiKeys = {
    findByHash: async (keyHash: string): Promise<ApiKeyRecord | null> => {
      const row = this.requireDb()
        .prepare<[string], ApiKeyRow>(
          `SELECT * FROM api_keys WHERE key_hash = ?`
        )
        .get(keyHash);
      return row ? mapApiKey(row) : null;
    },

    updateLastUsed: async (id: string): Promise<void> => {
      this.requireDb()
        .prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`)
        .run(nowIso(), id);
    },
  };
}
