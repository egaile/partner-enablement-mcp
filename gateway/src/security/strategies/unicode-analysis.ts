import type { ScanStrategy, ThreatIndicator } from "../types.js";

// Zero-width and invisible characters
const ZERO_WIDTH_CHARS = [
  0x200b, // Zero Width Space
  0x200c, // Zero Width Non-Joiner
  0x200d, // Zero Width Joiner
  0x2060, // Word Joiner
  0xfeff, // Zero Width No-Break Space (BOM)
  0x00ad, // Soft Hyphen
];

// Right-to-left override characters
const RTL_OVERRIDES = [
  0x200e, // Left-to-Right Mark
  0x200f, // Right-to-Left Mark
  0x202a, // Left-to-Right Embedding
  0x202b, // Right-to-Left Embedding
  0x202c, // Pop Directional Formatting
  0x202d, // Left-to-Right Override
  0x202e, // Right-to-Left Override
  0x2066, // Left-to-Right Isolate
  0x2067, // Right-to-Left Isolate
  0x2068, // First Strong Isolate
  0x2069, // Pop Directional Isolate
];

// Common homoglyph mappings (Cyrillic/Greek → Latin)
const HOMOGLYPH_RANGES: Array<{ start: number; end: number; name: string }> = [
  { start: 0x0400, end: 0x04ff, name: "Cyrillic" },
  { start: 0x0370, end: 0x03ff, name: "Greek" },
  { start: 0xff01, end: 0xff5e, name: "Fullwidth" },
];

export class UnicodeAnalysisStrategy implements ScanStrategy {
  name = "unicode_analysis";

  scan(input: string, fieldPath: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];

    // Check for zero-width characters
    const zeroWidthFound: string[] = [];
    for (const char of input) {
      const code = char.codePointAt(0);
      if (code !== undefined && ZERO_WIDTH_CHARS.includes(code)) {
        zeroWidthFound.push(`U+${code.toString(16).padStart(4, "0")}`);
      }
    }
    if (zeroWidthFound.length > 0) {
      indicators.push({
        strategy: this.name,
        severity: "critical",
        description: `Contains ${zeroWidthFound.length} invisible zero-width character(s): ${[...new Set(zeroWidthFound)].join(", ")}`,
        fieldPath,
      });
    }

    // Check for RTL overrides
    const rtlFound: string[] = [];
    for (const char of input) {
      const code = char.codePointAt(0);
      if (code !== undefined && RTL_OVERRIDES.includes(code)) {
        rtlFound.push(`U+${code.toString(16).padStart(4, "0")}`);
      }
    }
    if (rtlFound.length > 0) {
      indicators.push({
        strategy: this.name,
        severity: "critical",
        description: `Contains ${rtlFound.length} bidirectional override character(s): ${[...new Set(rtlFound)].join(", ")}`,
        fieldPath,
      });
    }

    // Check for mixed-script homoglyphs in primarily Latin text
    const latinChars = (input.match(/[a-zA-Z]/g) ?? []).length;
    if (latinChars > 5) {
      for (const range of HOMOGLYPH_RANGES) {
        let count = 0;
        for (const char of input) {
          const code = char.codePointAt(0);
          if (
            code !== undefined &&
            code >= range.start &&
            code <= range.end
          ) {
            count++;
          }
        }
        if (count > 0 && count < latinChars) {
          indicators.push({
            strategy: this.name,
            severity: "high",
            description: `Mixed scripts detected: ${count} ${range.name} character(s) in primarily Latin text (possible homoglyph attack)`,
            fieldPath,
          });
        }
      }
    }

    return indicators;
  }
}
