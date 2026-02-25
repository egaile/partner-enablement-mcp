import type { ScanStrategy, ThreatIndicator } from "../types.js";

interface StructuralPattern {
  pattern: RegExp;
  severity: ThreatIndicator["severity"];
  description: string;
}

const STRUCTURAL_PATTERNS: StructuralPattern[] = [
  // Embedded XML/HTML
  {
    pattern: /<script[\s>]/i,
    severity: "critical",
    description: "Contains embedded script tag",
  },
  {
    pattern: /<iframe[\s>]/i,
    severity: "critical",
    description: "Contains embedded iframe tag",
  },
  {
    pattern: /<object[\s>]/i,
    severity: "high",
    description: "Contains embedded object tag",
  },
  {
    pattern: /<embed[\s>]/i,
    severity: "high",
    description: "Contains embedded embed tag",
  },

  // Embedded system-level XML
  {
    pattern: /<system>/i,
    severity: "critical",
    description: "Contains <system> markup (potential prompt structure injection)",
  },
  {
    pattern: /<assistant>/i,
    severity: "high",
    description: "Contains <assistant> markup (potential role injection)",
  },
  {
    pattern: /<user>/i,
    severity: "medium",
    description: "Contains <user> markup (potential message boundary injection)",
  },
  {
    pattern: /<tool_result>/i,
    severity: "critical",
    description: "Contains <tool_result> markup (potential MCP response spoofing)",
  },
  {
    pattern: /<tool_use>/i,
    severity: "critical",
    description: "Contains <tool_use> markup (potential MCP tool invocation spoofing)",
  },

  // Embedded code blocks that could be executed
  {
    pattern: /```(?:python|javascript|js|bash|sh|sql|powershell)\s*\n.*(?:import\s+os|require\s*\(|exec\s*\(|eval\s*\(|system\s*\()/is,
    severity: "high",
    description: "Contains code block with potentially dangerous operations",
  },

  // JSON injection in text fields
  {
    pattern: /\{\s*"(?:role|content|function_call|tool_calls?)"\s*:/i,
    severity: "high",
    description: "Contains JSON structure resembling chat message or tool call",
  },

  // Markdown image/link with javascript
  {
    pattern: /!\[.*\]\(javascript:/i,
    severity: "critical",
    description: "Contains markdown image with javascript: protocol",
  },
  {
    pattern: /\[.*\]\(javascript:/i,
    severity: "critical",
    description: "Contains markdown link with javascript: protocol",
  },
];

export class StructuralStrategy implements ScanStrategy {
  name = "structural";

  scan(input: string, fieldPath: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];

    for (const { pattern, severity, description } of STRUCTURAL_PATTERNS) {
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
