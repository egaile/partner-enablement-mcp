import type { ScanStrategy, ThreatIndicator } from "../types.js";

interface ExfilPattern {
  pattern: RegExp;
  severity: ThreatIndicator["severity"];
  description: string;
}

/**
 * Default exempt domains. Replace via the constructor when wiring up
 * environment-specific allowlists (e.g. Atlassian MCP). Empty by default —
 * gateway-core ships generic.
 */
const DEFAULT_EXEMPT_DOMAINS: RegExp[] = [];

function isExemptUrl(url: string, exempt: RegExp[]): boolean {
  try {
    const hostname = new URL(url).hostname;
    return exempt.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

const EXFILTRATION_PATTERNS: ExfilPattern[] = [
  // URLs in unexpected fields
  {
    pattern: /https?:\/\/[^\s"'<>]{10,}/gi,
    severity: "info",
    description: "Contains URL that could be used for data exfiltration",
  },

  // Email addresses (potential data leak target)
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: "low",
    description: "Contains email address (potential exfiltration target)",
  },

  // Tool chaining instructions
  {
    pattern: /(?:then|after\s+that|next|also|additionally)\s+(?:call|use|invoke|run|execute)\s+(?:the\s+)?(?:tool|function|command)/i,
    severity: "high",
    description: "Contains tool chaining instructions (potential multi-step attack)",
  },

  // Request to send/transmit data
  {
    pattern: /(?:send|transmit|post|upload|forward|exfiltrate|leak)\s+(?:the\s+)?(?:data|results?|output|response|information|contents?)\s+(?:to|via|through)/i,
    severity: "critical",
    description: "Contains data exfiltration instructions",
  },

  // Webhook/callback patterns
  {
    pattern: /(?:webhook|callback|notify)\s*(?:url|endpoint|address)/i,
    severity: "high",
    description: "Contains webhook/callback reference (potential exfiltration channel)",
  },

  // Base64 encoding instructions (obfuscation)
  {
    pattern: /(?:base64|encode|encrypt|obfuscate)\s+(?:the\s+)?(?:data|output|response|result)/i,
    severity: "high",
    description: "Contains encoding/obfuscation instructions (potential evasion technique)",
  },

  // DNS exfiltration patterns
  {
    pattern: /\.(?:burpcollaborator\.net|oastify\.com|interact\.sh|requestbin\.com|pipedream\.com)/i,
    severity: "critical",
    description: "Contains known data exfiltration service domain",
  },

  // IP addresses (direct connection attempt)
  {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g,
    severity: "medium",
    description: "Contains IP address (potential direct exfiltration)",
  },
];

export interface ExfiltrationStrategyOptions {
  /** Domains exempt from URL exfiltration detection. */
  exemptDomains?: RegExp[];
}

export class ExfiltrationStrategy implements ScanStrategy {
  name = "exfiltration";
  private readonly exemptDomains: RegExp[];

  constructor(options?: ExfiltrationStrategyOptions) {
    this.exemptDomains = options?.exemptDomains ?? DEFAULT_EXEMPT_DOMAINS;
  }

  scan(input: string, fieldPath: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];

    for (const { pattern, severity, description } of EXFILTRATION_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      const match = input.match(pattern);
      if (match) {
        const matchedContent = match[0].substring(0, 100);
        // Skip URL matches if ALL matches point to exempt domains
        if (
          description.includes("URL") &&
          match.every((m) => isExemptUrl(m, this.exemptDomains))
        ) {
          continue;
        }

        indicators.push({
          strategy: this.name,
          severity,
          description,
          fieldPath,
          matchedContent,
        });
      }
    }

    return indicators;
  }
}
