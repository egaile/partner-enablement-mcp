/**
 * PII scanner with a pluggable pattern registry.
 *
 * gateway-core ships a `core` set of generic PII patterns (SSN, credit card,
 * email, phone, IP, DOB). Industry packs (e.g. @mcpshield/pack-healthcare)
 * register additional patterns via `registerPiiPattern()`. The scanner walks
 * every string field in tool params/responses and applies all registered
 * patterns.
 *
 * Public API (`scanForPii`, `redactPii`) is preserved for backwards compat
 * with the original gateway implementation.
 */

import type { DataClassification } from "../types/classification.js";

export interface PiiMatch {
  type: string;
  fieldPath: string;
  start: number;
  end: number;
  classification?: DataClassification;
}

export interface PiiScanResult {
  detected: boolean;
  matches: PiiMatch[];
  /** Highest classification of any match (set when patterns declare classification). */
  highestClassification?: DataClassification;
}

export interface PiiPatternEntry {
  type: string;
  pattern: RegExp;
  validator?: (match: string) => boolean;
  redactionLabel?: string;
  classification?: DataClassification;
}

const CLASSIFICATION_RANK: Record<DataClassification, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

// Credit card Luhn check for reducing false positives
function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

// === Core (always-on) patterns ===
const CORE_PATTERNS: PiiPatternEntry[] = [
  { type: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g, classification: "restricted" },
  {
    type: "credit_card",
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    validator: luhnCheck,
    classification: "restricted",
  },
  {
    type: "email",
    // Linear on long runs of letters (the unbounded version took ~20s on
    // 200KB): a match can only start at the beginning of a run, and the local
    // part is capped at 64 (RFC 5321). Trade-off: an address whose run of
    // local-part characters is longer than 64 isn't matched. Dropping the
    // lookbehind fixes that but costs ~2s per MB.
    pattern: /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}\b/g,
    classification: "internal",
  },
  {
    type: "phone",
    pattern: /\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    classification: "internal",
  },
  {
    type: "ip_address",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    classification: "internal",
  },
  {
    type: "date_of_birth",
    pattern: /\b(?:0[1-9]|1[0-2])[/.-](?:0[1-9]|[12]\d|3[01])[/.-](?:19|20)\d{2}\b/g,
    classification: "confidential",
  },
  // The MRN pattern is retained as a "core" baseline so existing behaviour
  // is byte-identical for self-hosted deployments without the healthcare
  // pack. Packs cannot override it: core patterns run before registered
  // pack patterns, so a pack pattern for the same text (e.g. the healthcare
  // pack's [PHI:MRN]) never sees the original match.
  {
    type: "medical_record",
    pattern: /\bMRN[:\s#-]*\d{4,12}\b/gi,
    classification: "restricted",
  },
];

// Additional patterns contributed by industry packs at runtime.
const REGISTERED_PATTERNS: PiiPatternEntry[] = [];

/**
 * Register a PII pattern from an industry pack.
 * Patterns are appended and run after the core patterns, in registration
 * order. When two patterns match the same text, the earlier one redacts it
 * first, so later registrations cannot change its redactionLabel.
 */
export function registerPiiPattern(entry: PiiPatternEntry): void {
  REGISTERED_PATTERNS.push(entry);
}

/**
 * Reset to the core baseline. Mostly useful for tests; callers that need a
 * fresh registry between scans should construct their own list and pass it
 * to `scanForPii(..., { patterns })`.
 */
export function resetPiiRegistry(): void {
  REGISTERED_PATTERNS.length = 0;
}

export function listPiiPatterns(): PiiPatternEntry[] {
  return [...CORE_PATTERNS, ...REGISTERED_PATTERNS];
}

function extractStrings(
  obj: unknown,
  prefix: string = ""
): Array<{ value: string; path: string }> {
  const results: Array<{ value: string; path: string }> = [];

  if (typeof obj === "string") {
    results.push({ value: obj, path: prefix || "root" });
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      results.push(...extractStrings(obj[i], `${prefix}[${i}]`));
    }
  } else if (obj && typeof obj === "object") {
    for (const [key, val] of Object.entries(obj)) {
      results.push(
        ...extractStrings(val, prefix ? `${prefix}.${key}` : key)
      );
    }
  }

  return results;
}

export interface PiiScanOptions {
  /** Override the pattern set (e.g. for tests). Defaults to core + registered. */
  patterns?: PiiPatternEntry[];
}

export function scanForPii(
  params: Record<string, unknown>,
  options?: PiiScanOptions
): PiiScanResult {
  const patterns = options?.patterns ?? listPiiPatterns();
  const matches: PiiMatch[] = [];
  const strings = extractStrings(params);
  let highestRank = -1;
  let highestClassification: DataClassification | undefined;

  for (const { value, path } of strings) {
    for (const entry of patterns) {
      const freshPattern = new RegExp(entry.pattern.source, entry.pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = freshPattern.exec(value)) !== null) {
        if (entry.validator && !entry.validator(match[0])) continue;
        matches.push({
          type: entry.type,
          fieldPath: path,
          start: match.index,
          end: match.index + match[0].length,
          classification: entry.classification,
        });
        if (entry.classification) {
          const rank = CLASSIFICATION_RANK[entry.classification];
          if (rank > highestRank) {
            highestRank = rank;
            highestClassification = entry.classification;
          }
        }
      }
    }
  }

  return {
    detected: matches.length > 0,
    matches,
    highestClassification,
  };
}

export function redactPii(text: string, options?: PiiScanOptions): string {
  const patterns = options?.patterns ?? listPiiPatterns();
  let result = text;
  for (const entry of patterns) {
    const freshPattern = new RegExp(entry.pattern.source, entry.pattern.flags);
    const label = entry.redactionLabel ?? "[REDACTED]";
    result = result.replace(freshPattern, (matched) => {
      if (entry.validator && !entry.validator(matched)) return matched;
      return label;
    });
  }
  return result;
}
