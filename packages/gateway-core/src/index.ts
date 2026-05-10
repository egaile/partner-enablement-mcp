/**
 * @mcpshield/gateway-core — public API surface.
 *
 * Phase 0 progress: storage abstraction, auth abstraction, config-as-code
 * loader. The proxy/scanner/policy modules land in a follow-up commit when
 * their gateway/ counterparts are moved.
 */

export * from "./schemas/index.js";
export * from "./storage/index.js";
export * from "./auth/index.js";
export * from "./config/index.js";

export const VERSION = "0.1.0";
