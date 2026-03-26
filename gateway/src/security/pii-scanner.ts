export interface PiiMatch {
  type: string;
  fieldPath: string;
  start: number;
  end: number;
}

export interface PiiScanResult {
  detected: boolean;
  matches: PiiMatch[];
}

const PII_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  // SSN: xxx-xx-xxxx
  { type: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  // Credit card: 13-19 digit sequences (with optional spaces/dashes)
  { type: "credit_card", pattern: /\b(?:\d[ -]*?){13,19}\b/g },
  // Email
  { type: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  // US phone: (xxx) xxx-xxxx or xxx-xxx-xxxx or +1xxxxxxxxxx
  { type: "phone", pattern: /\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g },
  // IPv4
  { type: "ip_address", pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
  // Date of birth patterns: MM/DD/YYYY, YYYY-MM-DD
  { type: "date_of_birth", pattern: /\b(?:0[1-9]|1[0-2])[/.-](?:0[1-9]|[12]\d|3[01])[/.-](?:19|20)\d{2}\b/g },
  // Medical record number (MRN) — common pattern: MRN followed by digits
  { type: "medical_record", pattern: /\bMRN[:\s#-]*\d{4,12}\b/gi },
];

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

export function scanForPii(params: Record<string, unknown>): PiiScanResult {
  const matches: PiiMatch[] = [];
  const strings = extractStrings(params);

  for (const { value, path } of strings) {
    for (const { type, pattern } of PII_PATTERNS) {
      // Create a fresh RegExp to avoid shared lastIndex under concurrency
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = freshPattern.exec(value)) !== null) {
        // Extra validation for credit cards
        if (type === "credit_card" && !luhnCheck(match[0])) continue;
        matches.push({
          type,
          fieldPath: path,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  return {
    detected: matches.length > 0,
    matches,
  };
}

export function redactPii(text: string): string {
  let result = text;
  for (const { type, pattern } of PII_PATTERNS) {
    // Create a fresh RegExp to avoid shared lastIndex under concurrency
    const freshPattern = new RegExp(pattern.source, pattern.flags);
    result = result.replace(freshPattern, (matched) => {
      // Apply Luhn validation for credit card patterns to avoid false positives
      if (type === "credit_card" && !luhnCheck(matched)) return matched;
      return "[REDACTED]";
    });
  }
  return result;
}
