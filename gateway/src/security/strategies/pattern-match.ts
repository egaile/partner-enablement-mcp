import type { ScanStrategy, ThreatIndicator } from "../types.js";

interface PatternDef {
  pattern: RegExp;
  severity: ThreatIndicator["severity"];
  description: string;
}

const INJECTION_PATTERNS: PatternDef[] = [
  // Direct instruction override
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    severity: "critical",
    description: "Attempts to override prior instructions",
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?|guidelines?)/i,
    severity: "critical",
    description: "Attempts to disregard system instructions",
  },
  {
    pattern: /forget\s+(everything|all|your)\s+(you\s+)?(know|were\s+told|instructions?)/i,
    severity: "critical",
    description: "Attempts to reset system context",
  },

  // Role injection
  {
    pattern: /you\s+are\s+(now|a|an)\s+/i,
    severity: "high",
    description: "Attempts role injection via identity reassignment",
  },
  {
    pattern: /act\s+as\s+(if\s+you\s+are|a|an|my)\s+/i,
    severity: "high",
    description: "Attempts role injection via behavioral override",
  },
  {
    pattern: /pretend\s+(you\s+are|to\s+be)\s+/i,
    severity: "high",
    description: "Attempts role injection via pretense",
  },
  {
    pattern: /switch\s+to\s+.*mode/i,
    severity: "high",
    description: "Attempts to change operational mode",
  },

  // System prompt extraction
  {
    pattern: /what\s+(are|is)\s+your\s+(system\s+)?(instructions?|prompts?|rules?)/i,
    severity: "medium",
    description: "Attempts to extract system prompt",
  },
  {
    pattern: /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?)/i,
    severity: "medium",
    description: "Attempts to reveal system prompt",
  },
  {
    pattern: /print\s+(your\s+)?(initial|system|original)\s+(prompt|instructions?|message)/i,
    severity: "medium",
    description: "Attempts to print system prompt",
  },

  // Delimiter-based injection
  {
    pattern: /\[SYSTEM\]/i,
    severity: "critical",
    description: "Contains system-level delimiter injection",
  },
  {
    pattern: /\[INST\]/i,
    severity: "critical",
    description: "Contains instruction delimiter injection",
  },
  {
    pattern: /<<\s*SYS\s*>>/i,
    severity: "critical",
    description: "Contains Llama-style system delimiter",
  },
  {
    pattern: /<\|im_start\|>/i,
    severity: "critical",
    description: "Contains ChatML delimiter injection",
  },

  // Jailbreak patterns
  {
    pattern: /DAN\s*(mode|prompt|jailbreak)/i,
    severity: "critical",
    description: "Contains DAN jailbreak pattern",
  },
  {
    pattern: /developer\s+mode\s+(enabled|activated|on)/i,
    severity: "critical",
    description: "Contains developer mode jailbreak",
  },
];

export class PatternMatchStrategy implements ScanStrategy {
  name = "pattern_match";

  scan(input: string, fieldPath: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];

    for (const { pattern, severity, description } of INJECTION_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        indicators.push({
          strategy: this.name,
          severity,
          description,
          fieldPath,
          matchedContent: match[0].substring(0, 100),
        });
      }
    }

    return indicators;
  }
}
