import { randomBytes, createHash } from "node:crypto";
import {
  getApiKeyByHash,
  updateLastUsed,
} from "../db/queries/api-keys.js";

const KEY_PREFIX = "mgw_";
const RANDOM_BYTES = 16; // 16 bytes = 32 hex chars

export interface GeneratedKey {
  key: string;
  keyHash: string;
  keyPrefix: string;
}

/**
 * Generate a new API key with the format `mgw_<32 hex chars>`.
 * Returns the raw key (to show once), its SHA-256 hash (to store), and a prefix (first 8 chars for display).
 */
export function generateApiKey(): GeneratedKey {
  const random = randomBytes(RANDOM_BYTES).toString("hex");
  const key = `${KEY_PREFIX}${random}`;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const keyPrefix = key.slice(0, 8);

  return { key, keyHash, keyPrefix };
}

export interface VerifyResult {
  valid: boolean;
  keyRecord?: {
    id: string;
    tenantId: string;
    name: string;
    createdBy: string;
    expiresAt: string | null;
  };
}

/**
 * Verify an API key against the database.
 * Computes the SHA-256 hash of the provided key, looks it up in the db
 * matching both key_hash and tenant_id, and updates last_used_at on success.
 */
export async function verifyApiKey(
  key: string,
  tenantId: string
): Promise<VerifyResult> {
  const keyHash = createHash("sha256").update(key).digest("hex");

  const record = await getApiKeyByHash(keyHash);

  if (!record || record.tenantId !== tenantId) {
    return { valid: false };
  }

  // Check expiry
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return { valid: false };
  }

  // Update last used timestamp (fire-and-forget)
  updateLastUsed(record.id).catch(() => {
    // Silently ignore — non-critical update
  });

  return {
    valid: true,
    keyRecord: {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      createdBy: record.createdBy,
      expiresAt: record.expiresAt,
    },
  };
}
