/**
 * Audit enricher registry.
 *
 * Packs register `AuditEnricher`s via `registerAuditEnricher()`. The
 * `applyEnrichers()` helper runs every registered enricher and merges
 * each non-empty result into the entry's `threatDetails` under the
 * enricher's namespace.
 *
 * Cloud's AuditLogger calls `applyEnrichers()` from its `record()`
 * override. Self-host can do the same; the SQLite-backed BaseAuditLogger
 * leaves this opt-in so tiny deployments don't pay for enrichers they
 * didn't ask for.
 */

import type { AuditEnricher } from "@mcpshield/sdk";
import type { AuditEntry } from "../schemas/index.js";

const REGISTERED: AuditEnricher[] = [];

export function registerAuditEnricher(enricher: AuditEnricher): void {
  REGISTERED.push(enricher);
}

/** Test + admin helper. */
export function listAuditEnrichers(): AuditEnricher[] {
  return [...REGISTERED];
}

/** Test helper — clear the registry. */
export function resetAuditEnrichers(): void {
  REGISTERED.length = 0;
}

/**
 * Run every registered enricher against the given tool params; merge the
 * non-empty results into the entry under their respective namespaces.
 * Returns a new entry — never mutates the input.
 */
export function applyEnrichers(
  entry: AuditEntry,
  toolParams: Record<string, unknown>
): AuditEntry {
  if (REGISTERED.length === 0) return entry;

  const additions: Record<string, unknown> = {};
  for (const enricher of REGISTERED) {
    try {
      const value = enricher.enrich(entry.toolName, toolParams);
      if (value && hasAnyValue(value)) {
        additions[enricher.namespace] = value;
      }
    } catch (err) {
      console.error(
        `[audit] Enricher "${enricher.namespace}" threw:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (Object.keys(additions).length === 0) return entry;

  return {
    ...entry,
    threatDetails: {
      ...((entry.threatDetails as Record<string, unknown>) ?? {}),
      ...additions,
    },
  };
}

function hasAnyValue(obj: Record<string, unknown>): boolean {
  for (const v of Object.values(obj)) {
    if (v !== null && v !== undefined && v !== "" && v !== "unknown") {
      return true;
    }
  }
  return false;
}
