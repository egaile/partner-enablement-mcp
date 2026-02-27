import type { ScanStrategy, ThreatIndicator } from "../types.js";

interface PatternDef {
  pattern: RegExp;
  severity: ThreatIndicator["severity"];
  description: string;
}

/**
 * Atlassian-specific injection patterns targeting Jira and Confluence content.
 * Detects prompt injection payloads commonly embedded in issue descriptions,
 * comments, and Confluence pages to manipulate AI agents.
 */
const ATLASSIAN_PATTERNS: PatternDef[] = [
  // === Jira Issue Injection ===
  // Malicious instructions embedded in issue descriptions/comments
  {
    pattern: /(?:^|\n)\s*(?:@ai|@agent|@assistant|@claude|@copilot)\s*[:\-]\s*/im,
    severity: "high",
    description: "Atlassian: AI agent directive embedded in content",
  },
  {
    pattern: /(?:when\s+(?:an?\s+)?(?:ai|agent|assistant|bot)\s+reads?\s+this)/i,
    severity: "critical",
    description: "Atlassian: Conditional trigger targeting AI agent readers",
  },
  {
    pattern: /(?:if\s+you\s+are\s+(?:an?\s+)?(?:ai|agent|assistant|llm|bot))/i,
    severity: "critical",
    description: "Atlassian: Conditional logic targeting AI identity",
  },
  {
    pattern: /(?:important\s+instruction|hidden\s+instruction|secret\s+instruction)\s*(?:for|to)\s+(?:the\s+)?(?:ai|agent|assistant)/i,
    severity: "critical",
    description: "Atlassian: Explicit hidden instruction for AI agents",
  },

  // === Invisible/Hidden Content in Jira/Confluence ===
  {
    pattern: /\{color:#(?:ffffff|FFFFFF)\}[\s\S]+?\{color\}/,
    severity: "high",
    description: "Atlassian: White-text hiding in Confluence color macro",
  },
  {
    pattern: /\{html\}[\s\S]*?(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0)[\s\S]*?\{html\}/i,
    severity: "critical",
    description: "Atlassian: Hidden content via CSS in Confluence HTML macro",
  },
  {
    pattern: /<!--[\s\S]*?(?:ignore|disregard|override|instruction|system\s+prompt)[\s\S]*?-->/i,
    severity: "high",
    description: "Atlassian: Injection payload hidden in HTML comments",
  },

  // === JQL Injection ===
  {
    pattern: /project\s*(?:=|in)\s*\(\s*\*\s*\)/i,
    severity: "high",
    description: "Atlassian: JQL wildcard project access attempt",
  },
  {
    pattern: /(?:order\s+by\s+|union\s+|;\s*(?:select|drop|delete|insert|update)\s)/i,
    severity: "critical",
    description: "Atlassian: JQL/SQL injection attempt",
  },
  {
    pattern: /(?:assignee|reporter)\s*(?:=|!=|in)\s*(?:membersOf|currentUser)\s*\(\s*\)\s*(?:or|OR)\s*(?:1\s*=\s*1|true)/i,
    severity: "critical",
    description: "Atlassian: JQL logic bypass via tautology",
  },

  // === Cross-Project Data Leakage ===
  {
    pattern: /(?:also|then|next|additionally)\s+(?:search|find|get|read|list|fetch)\s+(?:issues?|tickets?|pages?)\s+(?:from|in)\s+(?:all|every|other)\s+projects?/i,
    severity: "high",
    description: "Atlassian: Cross-project data access instruction",
  },
  {
    pattern: /(?:copy|move|send|export|transfer)\s+(?:this|the|all)\s+(?:data|content|issues?|information)\s+(?:to|into)\s+/i,
    severity: "medium",
    description: "Atlassian: Data exfiltration instruction in Jira context",
  },

  // === Confluence Page Injection ===
  {
    pattern: /\{panel(?::title=[^}]*)?\}[\s\S]*?(?:ignore\s+previous|system\s+prompt|override\s+instruction)[\s\S]*?\{panel\}/i,
    severity: "critical",
    description: "Atlassian: Injection hidden in Confluence panel macro",
  },
  {
    pattern: /\{expand(?::title=[^}]*)?\}[\s\S]*?(?:ignore|disregard|override)[\s\S]*?\{expand\}/i,
    severity: "high",
    description: "Atlassian: Injection hidden in Confluence expand macro",
  },
  {
    pattern: /\{noformat\}[\s\S]*?(?:\[SYSTEM\]|\[INST\]|<<SYS>>|<\|im_start\|>)[\s\S]*?\{noformat\}/i,
    severity: "critical",
    description: "Atlassian: LLM delimiters hidden in Confluence noformat block",
  },

  // === Atlassian API Abuse ===
  {
    pattern: /(?:create|update|delete|transition)\s+(?:all|every|multiple)\s+(?:issues?|tickets?|pages?|stories|epics?)\s+(?:in|across|for)\s+/i,
    severity: "medium",
    description: "Atlassian: Bulk operation instruction targeting multiple items",
  },
  {
    pattern: /(?:change|set|update)\s+(?:the\s+)?(?:assignee|reporter|priority|status)\s+(?:of|for)\s+(?:all|every)\s+/i,
    severity: "high",
    description: "Atlassian: Mass field modification instruction",
  },

  // === Jira Workflow Manipulation ===
  {
    pattern: /(?:transition|move)\s+(?:this\s+)?(?:issue|ticket)\s+(?:to|into)\s+(?:done|closed|resolved|deployed|released)\s+(?:and\s+then|without)/i,
    severity: "medium",
    description: "Atlassian: Workflow bypass via direct transition instruction",
  },

  // === Base64 Payloads in Custom Fields ===
  {
    pattern: /(?:customfield_\d+|cf\[\d+\])\s*[:=]\s*[A-Za-z0-9+/]{50,}={0,2}/,
    severity: "high",
    description: "Atlassian: Possible base64 payload in Jira custom field",
  },
];

export class AtlassianInjectionStrategy implements ScanStrategy {
  name = "atlassian_injection";

  scan(input: string, fieldPath: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];

    for (const { pattern, severity, description } of ATLASSIAN_PATTERNS) {
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
