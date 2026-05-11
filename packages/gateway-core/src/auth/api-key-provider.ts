/**
 * ApiKeyAuthProvider — OSS default AuthProvider.
 *
 * Accepts `Authorization: Bearer mgw_<32 hex>`. Hashes the key with SHA-256,
 * looks it up via the StorageBackend, validates expiry, returns a Principal
 * scoped to the key's tenant.
 *
 * Also exports `generateApiKey()` for issuing new keys (used by the CLI and
 * dashboard).
 */

import { createHash, randomBytes } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { StorageBackend } from "../storage/types.js";
import { AuthError, type AuthProvider, type Principal } from "./types.js";

const KEY_PREFIX = "mgw_";
const RANDOM_BYTES = 16; // 32 hex chars

export interface GeneratedKey {
  /** The full key. Show once, never store. */
  key: string;
  /** SHA-256 hash of the key. Persist this, not the raw key. */
  keyHash: string;
  /** First 8 chars of the key for human-readable display. */
  keyPrefix: string;
}

/**
 * Generate a new API key in the format `mgw_<32 hex chars>`.
 */
export function generateApiKey(): GeneratedKey {
  const random = randomBytes(RANDOM_BYTES).toString("hex");
  const key = `${KEY_PREFIX}${random}`;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const keyPrefix = key.slice(0, 8);
  return { key, keyHash, keyPrefix };
}

/**
 * Hash a raw key for verification. Exposed for tests + admin tooling.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface ApiKeyAuthOptions {
  storage: StorageBackend;
  /** Default plan returned in Principal for OSS deployments. */
  defaultPlan?: string;
}

export class ApiKeyAuthProvider implements AuthProvider {
  private readonly storage: StorageBackend;
  private readonly defaultPlan: string;

  constructor(options: ApiKeyAuthOptions) {
    this.storage = options.storage;
    this.defaultPlan = options.defaultPlan ?? "self_hosted";
  }

  async authenticate(headers: IncomingHttpHeaders): Promise<Principal | null> {
    const authHeader = headers.authorization;
    if (!authHeader || typeof authHeader !== "string") {
      return null;
    }
    if (!authHeader.startsWith("Bearer ")) {
      return null;
    }
    const token = authHeader.slice(7).trim();
    if (!token.startsWith(KEY_PREFIX)) {
      return null;
    }

    const keyHash = hashApiKey(token);
    const record = await this.storage.apiKeys.findByHash(keyHash);
    if (!record) {
      throw new AuthError("Invalid API key", 401);
    }
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      throw new AuthError("API key has expired", 401);
    }

    const tenant = await this.storage.tenants.getById(record.tenantId);
    if (!tenant) {
      throw new AuthError("Tenant not found for API key", 403);
    }

    // Fire-and-forget last-used update
    this.storage.apiKeys.updateLastUsed(record.id).catch(() => {});

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userId: `apikey:${record.id}`,
      role: "member",
      plan: this.defaultPlan,
    };
  }
}
