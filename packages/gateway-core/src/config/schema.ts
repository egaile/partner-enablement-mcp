/**
 * Zod schema for `mcpshield.yaml` — the OSS config-as-code source of truth.
 *
 * Cloud users define the same concepts via the dashboard (which writes to the
 * Supabase StorageBackend); OSS users define them in YAML and the loader
 * upserts via the StorageBackend on each (re)load.
 */

import { z } from "zod";

const ServerConfig = z
  .object({
    id: z.string().min(1).describe("Stable identifier — used as upsert key"),
    name: z.string().min(1).optional().describe("Human-readable name; defaults to id"),
    transport: z.enum(["stdio", "http"]),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().url().optional(),
    env: z.record(z.string()).optional(),
    authHeaders: z.record(z.string()).optional(),
    enabled: z.boolean().default(true),
    auth: z
      .union([
        z.literal("none"),
        z.literal("static"),
        z.literal("oauth2"),
      ])
      .default("none"),
    oauth: z
      .object({
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        tokenUrl: z.string().url().optional(),
        authorizeUrl: z.string().url().optional(),
        scopes: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .strict()
  .refine(
    (s) =>
      s.transport === "stdio"
        ? Boolean(s.command)
        : Boolean(s.url),
    { message: "stdio servers require `command`; http servers require `url`" }
  );

const PolicyCondition = z
  .object({
    servers: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    users: z.array(z.string()).optional(),
    timeWindows: z
      .array(
        z.object({
          daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
          startHour: z.number().int().min(0).max(23).optional(),
          endHour: z.number().int().min(0).max(23).optional(),
        })
      )
      .optional(),
  })
  .strict();

const PolicyModifiers = z
  .object({
    redactPII: z.boolean().optional(),
    redactSecrets: z.boolean().optional(),
    maxCallsPerMinute: z.number().int().positive().optional(),
    requireMFA: z.boolean().optional(),
  })
  .strict();

const PolicyConfig = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    priority: z.number().int().min(0).max(10000).default(1000),
    conditions: PolicyCondition,
    action: z.enum(["allow", "deny", "require_approval", "log_only"]),
    modifiers: PolicyModifiers.optional(),
    enabled: z.boolean().default(true),
  })
  .strict();

const AuditConfig = z
  .object({
    backend: z.enum(["sqlite", "supabase"]).default("sqlite"),
    path: z.string().optional().describe("Path to SQLite DB file"),
    batchSize: z.number().int().positive().optional(),
    flushIntervalMs: z.number().int().positive().optional(),
  })
  .strict()
  .default({ backend: "sqlite" });

const ServerSettings = z
  .object({
    host: z.string().default("0.0.0.0"),
    port: z.number().int().min(1).max(65535).default(4000),
    /** CORS allowlist for the proxy HTTP endpoint. */
    allowedOrigins: z.array(z.string()).optional(),
  })
  .strict()
  .default({ host: "0.0.0.0", port: 4000 });

const TelemetryConfig = z
  .object({
    enabled: z.boolean().default(false),
    endpoint: z.string().url().optional(),
  })
  .strict()
  .default({ enabled: false });

export const McpShieldConfigSchema = z
  .object({
    /** Tenant identifier for OSS deployments. Defaults to the built-in singleton tenant. */
    tenantId: z.string().optional(),
    server: ServerSettings,
    audit: AuditConfig,
    telemetry: TelemetryConfig,
    /** npm package ids of industry packs to load. */
    packs: z.array(z.string()).default([]),
    /** Downstream MCP servers to proxy. */
    servers: z.array(ServerConfig).default([]),
    /** Policy rules. Evaluated in priority order; first match wins. */
    policies: z.array(PolicyConfig).default([]),
  })
  .strict();

export type McpShieldConfig = z.infer<typeof McpShieldConfigSchema>;
export type ServerConfigEntry = z.infer<typeof ServerConfig>;
export type PolicyConfigEntry = z.infer<typeof PolicyConfig>;
