/**
 * Cloud-flavored PolicyEngine. Inherits all logic from the gateway-core
 * implementation; injects the Supabase storage port and reads the cache TTL
 * from env-driven config.
 */

import { PolicyEngine as CorePolicyEngine } from "@mcpshield/gateway-core/policy";
import { loadConfig } from "../config.js";
import { SupabaseStorageBackend } from "../storage/supabase.js";

let _defaultBackend: SupabaseStorageBackend | null = null;
function defaultBackend(): SupabaseStorageBackend {
  if (!_defaultBackend) _defaultBackend = new SupabaseStorageBackend();
  return _defaultBackend;
}

export class PolicyEngine extends CorePolicyEngine {
  constructor(cacheTtlMs?: number) {
    let resolvedTtl = cacheTtlMs;
    if (resolvedTtl === undefined) {
      try {
        resolvedTtl = loadConfig().policyCacheTtlMs;
      } catch {
        resolvedTtl = 30_000;
      }
    }
    super({
      policies: defaultBackend().policies,
      cacheTtlMs: resolvedTtl,
    });
  }
}
