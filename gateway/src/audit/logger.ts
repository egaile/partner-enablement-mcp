/**
 * AuditLogger — cloud-flavored extension of @mcpshield/gateway-core's
 * BaseAuditLogger. Adds usage-meter billing hooks and runs every
 * registered audit enricher (e.g. the Atlassian enricher contributed by
 * @mcpshield/pack-atlassian) on top of the generic batched flush.
 *
 * Default constructor wires up the SupabaseStorageBackend for the existing
 * gateway runtime; tests can pass their own audit port for isolation.
 */

import {
  BaseAuditLogger,
  applyEnrichers,
  type AuditAppendPort,
  type AuditEntry,
} from "@mcpshield/gateway-core/audit";
import { loadConfig } from "../config.js";
import type { UsageMeter } from "../billing/usage-meter.js";
import { SupabaseStorageBackend } from "../storage/supabase.js";

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
   * Log after running every registered audit enricher (e.g. the
   * Atlassian enricher contributed by @mcpshield/pack-atlassian).
   * Each enricher's non-empty result is stored under its namespace in
   * `threatDetails`.
   */
  logEnriched(
    entry: AuditEntry,
    toolParams?: Record<string, unknown>
  ): void {
    if (toolParams) {
      this.log(applyEnrichers(entry, toolParams));
      return;
    }
    this.log(entry);
  }

  /**
   * AuditRecorder port override — routes proxy writes through the
   * enricher pipeline.
   */
  override record(
    entry: AuditEntry,
    toolParams?: Record<string, unknown>
  ): void {
    this.logEnriched(entry, toolParams);
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
