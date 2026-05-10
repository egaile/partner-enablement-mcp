/**
 * @mcpshield/gateway-core — public API surface.
 *
 * Phase 0 progress: storage abstraction (StorageBackend + SQLite), auth
 * abstraction (AuthProvider + API-key), config-as-code loader, the entire
 * scanner pipeline (PromptInjectionScanner + 4 strategies + secrets), the
 * PII registry (with classification), the rate limiter, drift result types,
 * and audit utilities.
 *
 * Storage-dependent modules (audit logger, drift detector, policy engine,
 * connection manager, proxy engine) ship in a follow-up commit once the
 * cloud control plane has its SupabaseStorageBackend adapter.
 */

export * from "./schemas/index.js";
export * from "./types/classification.js";
export * from "./storage/index.js";
export * from "./auth/index.js";
export * from "./security/index.js";
export * from "./config/index.js";
export * from "./policy/index.js";
export * from "./monitor/index.js";
export * from "./audit/index.js";

export const VERSION = "0.1.0";
