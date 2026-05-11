/**
 * Industry-pack loader.
 *
 * Given a list of npm package ids (e.g. `["@mcpshield/pack-healthcare"]`),
 * dynamically imports each one, reads its default-export `IndustryPack`,
 * and registers the pack's PII patterns into the gateway's runtime scanner.
 *
 * Policy templates are *exposed* via the returned `LoadedPack[]` but NOT
 * auto-applied — applying templates is an admin decision (dashboard / CLI
 * `templates apply <id>` in a future commit).
 *
 * Failure mode: a single broken pack logs an error and is skipped; other
 * packs still load. The gateway never refuses to boot because of a pack.
 */

import type { IndustryPack } from "@mcpshield/sdk";
import { registerPiiPattern } from "../security/pii-scanner.js";

export interface LoadedPack {
  /** The npm package id used to import (e.g. `@mcpshield/pack-healthcare`). */
  source: string;
  /** The pack manifest (default export of the module). */
  pack: IndustryPack;
}

export interface LoadPacksResult {
  loaded: LoadedPack[];
  failed: Array<{ source: string; reason: string }>;
}

/**
 * Dynamically import each pack id, validate the default export shape,
 * register its PII patterns, and return the loaded set.
 */
export async function loadPacks(
  packIds: string[]
): Promise<LoadPacksResult> {
  const loaded: LoadedPack[] = [];
  const failed: Array<{ source: string; reason: string }> = [];

  for (const id of packIds) {
    try {
      const mod = (await import(id)) as { default?: unknown };
      const pack = mod.default;
      if (!isIndustryPack(pack)) {
        failed.push({
          source: id,
          reason: "default export is not a valid IndustryPack (missing id / pii / policyTemplates)",
        });
        continue;
      }
      for (const p of pack.pii) {
        registerPiiPattern({
          type: p.type,
          pattern: p.pattern,
          validator: p.validator,
          redactionLabel: p.redactionLabel,
          classification: p.classification,
        });
      }
      loaded.push({ source: id, pack });
    } catch (err) {
      failed.push({
        source: id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { loaded, failed };
}

function isIndustryPack(value: unknown): value is IndustryPack {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    Array.isArray(v.pii) &&
    Array.isArray(v.policyTemplates) &&
    Array.isArray(v.compliance)
  );
}
