/**
 * AuditLogger — cloud-flavored extension of @mcpshield/gateway-core's
 * BaseAuditLogger. Adds Atlassian metadata enrichment and usage-meter
 * billing hooks on top of the generic batched flush.
 *
 * Default constructor wires up the SupabaseStorageBackend for the existing
 * gateway runtime; tests can pass their own audit port for isolation.
 */

import {
  BaseAuditLogger,
  type AuditAppendPort,
  type AuditEntry,
} from "@mcpshield/gateway-core/audit";
import { loadConfig } from "../config.js";
import {
  enrichAtlassianMetadata,
  type AtlassianMetadata,
} from "./atlassian-enricher.js";
import type { UsageMeter } from "../billing/usage-meter.js";
import { SupabaseStorageBackend } from "../storage/supabase.js";

export interface EnrichedAuditEntry extends AuditEntry {
  atlassianMetadata?: AtlassianMetadata;
}

export interface AuditLoggerOptions {
  audit?: AuditAppendPort;
  batchSize?: number;
  flushIntervalMs?: number;
  maxBufferSize?: number;
}

let _defaultBackend: SupabaseStorageBackend | null = null;
function defaultAuditPort(): AuditAppendPort {
  if (!_defaultBackend) _defaultBackend = new SupabaseStorageBackend();
  return _defaultBackend.audit;
}

export class AuditLogger extends BaseAuditLogger {
  private usageMeter: UsageMeter | null = null;

  constructor(options?: AuditLoggerOptions) {
    const config = loadConfigSafe();
    super({
      audit: options?.audit ?? defaultAuditPort(),
      batchSize: options?.batchSize ?? config.auditBatchSize,
      flushIntervalMs: options?.flushIntervalMs ?? config.auditFlushIntervalMs,
      maxBufferSize: options?.maxBufferSize ?? 10000,
    });
  }

  /**
   * Attach a usage meter to record billing events on each log entry.
   */
  setUsageMeter(meter: UsageMeter): void {
    this.usageMeter = meter;
  }

  protected override onLogged(entry: AuditEntry): void {
    if (this.usageMeter) {
      this.usageMeter.record(entry.tenantId, !entry.success);
    }
  }

  /**
   * Log with Atlassian-aware enrichment.
   * Extracts project keys, space keys, and operation types from tool params.
   */
  logEnriched(
    entry: AuditEntry,
    toolParams?: Record<string, unknown>
  ): void {
    if (toolParams) {
      const metadata = enrichAtlassianMetadata(entry.toolName, toolParams);
      if (
        metadata.projectKey ||
        metadata.spaceKey ||
        metadata.operationType !== "unknown"
      ) {
        const enriched = {
          ...entry,
          threatDetails: {
            ...((entry.threatDetails as Record<string, unknown>) ?? {}),
            atlassian: metadata,
          },
        };
        this.log(enriched);
        return;
      }
    }
    this.log(entry);
  }
}

/**
 * Load config defensively so AuditLogger tests don't have to mock it as long
 * as required env vars are present (or the test passes explicit options).
 */
function loadConfigSafe(): {
  auditBatchSize: number;
  auditFlushIntervalMs: number;
} {
  try {
    const cfg = loadConfig();
    return {
      auditBatchSize: cfg.auditBatchSize,
      auditFlushIntervalMs: cfg.auditFlushIntervalMs,
    };
  } catch {
    return { auditBatchSize: 50, auditFlushIntervalMs: 5000 };
  }
}
