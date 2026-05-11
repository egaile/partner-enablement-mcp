/**
 * @mcpshield/gateway-core — public API surface.
 *
 * Includes:
 *   - Storage abstraction (StorageBackend + SQLite reference impl)
 *   - Auth abstraction (AuthProvider + API-key reference impl)
 *   - Config-as-code loader
 *   - Scanner pipeline (PromptInjectionScanner + 4 strategies + secrets)
 *   - PII registry with classification
 *   - Rate limiter
 *   - Drift detector + audit utilities
 *   - Policy engine
 *   - Proxy subsystem (GatewayProxyEngine, ConnectionManager, ToolInterceptor,
 *     HealthChecker) with pluggable cloud ports for alerts, billing, and OAuth
 *
 * Cloud-only concerns (multi-tenancy plumbing, billing, Clerk auth, hosted
 * dashboard, Atlassian-specific scanners) live in the closed-source cloud
 * control plane and adapt to this core via the documented ports.
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
export * from "./proxy/index.js";
export * from "./webhooks/index.js";
export * from "./approval/index.js";

export const VERSION = "0.1.0";
