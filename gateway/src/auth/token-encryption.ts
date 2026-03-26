import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Rec 6: Application-level encryption for OAuth tokens at rest.
 * Uses AES-256-GCM with a key derived from TOKEN_ENCRYPTION_KEY env var.
 * If the env var is not set, encryption is a no-op (returns plaintext) to
 * allow gradual adoption without breaking existing deployments.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
// Known limitation for demo: static salt. In production, set TOKEN_ENCRYPTION_SALT
// env var to a unique, high-entropy value per deployment.
const SALT = process.env.TOKEN_ENCRYPTION_SALT ?? "mcp-gateway-token-salt";

// Cache the derived key at module scope — scryptSync is intentionally slow
// (~50-200ms) and the result is deterministic for a given env var + salt.
let _cachedKey: Buffer | null | undefined;

function getDerivedKey(): Buffer | null {
  if (_cachedKey !== undefined) return _cachedKey;
  const envKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!envKey) {
    _cachedKey = null;
    return null;
  }
  _cachedKey = scryptSync(envKey, SALT, 32);
  return _cachedKey;
}

/**
 * Encrypt a plaintext string. Returns a base64-encoded string containing
 * iv + ciphertext + authTag. If TOKEN_ENCRYPTION_KEY is not set, returns
 * the plaintext unchanged (graceful degradation).
 */
export function encryptToken(plaintext: string): string {
  const key = getDerivedKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: base64(iv + encrypted + tag), prefixed with "enc:" so we can detect encrypted values
  const combined = Buffer.concat([iv, encrypted, tag]);
  return `enc:${combined.toString("base64")}`;
}

/**
 * Decrypt an encrypted token. If the value doesn't start with "enc:", it's
 * assumed to be plaintext (not yet encrypted) and returned as-is.
 */
export function decryptToken(encrypted: string): string {
  if (!encrypted.startsWith("enc:")) return encrypted;

  const key = getDerivedKey();
  if (!key) {
    throw new Error(
      "[token-encryption] TOKEN_ENCRYPTION_KEY is not set but an encrypted token (enc: prefix) was found. " +
      "Set TOKEN_ENCRYPTION_KEY to decrypt stored tokens."
    );
  }

  try {
    const combined = Buffer.from(encrypted.slice(4), "base64");
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(combined.length - TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `[token-encryption] Failed to decrypt token: ${msg}. ` +
      "The TOKEN_ENCRYPTION_KEY may have changed or the encrypted data may be corrupted."
    );
  }
}
