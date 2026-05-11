/**
 * AuthProvider — pluggable authentication strategy.
 *
 * The proxy speaks to the request via an `AuthProvider`, which extracts a
 * `Principal` (tenantId + userId + role) from the request. Two reference
 * implementations:
 *
 *   - ApiKeyAuthProvider — OSS default. Reads `Authorization: Bearer mgw_*`,
 *     looks up the SHA-256 hash via the StorageBackend, returns a tenant-scoped
 *     principal.
 *   - ClerkAuthProvider — cloud only. Verifies a Clerk JWT and resolves the
 *     tenant via tenant_users mapping.
 *
 * Both implement the same interface; the proxy doesn't know which is wired up.
 */

import type { IncomingHttpHeaders } from "node:http";

export interface Principal {
  tenantId: string;
  tenantName: string;
  userId: string;
  /** "owner" | "admin" | "member" | "viewer" — provider-defined string for forward compat. */
  role: string;
  /** Billing plan id for the tenant. OSS providers may return "self_hosted". */
  plan: string;
}

export interface AuthProvider {
  /**
   * Extract the principal from request headers. Returns null if no credentials
   * are presented at all (caller decides whether to reject or pass through).
   * Throws an `AuthError` for invalid/expired credentials.
   */
  authenticate(headers: IncomingHttpHeaders): Promise<Principal | null>;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403 = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}
