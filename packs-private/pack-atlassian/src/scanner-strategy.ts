import type { ScanStrategy, ThreatIndicator } from "@mcpshield/sdk";

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
    // `[^\S\r\n\u2028\u2029]` is whitespace that isn't a line terminator (so
    // NBSP and ideographic spaces count). Anything that can also start a line
    // under the m flag (\n, \r, U+2028, U+2029) makes this quadratic.
    pattern: /^[^\S\r\n\u2028\u2029]*(?:@ai|@agent|@assistant|@claude|@copilot)[^\S\r\n\u2028\u2029]*[:\-]/im,
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

  // Hidden-content and macro rules (color, html, comments, panel, expand,
  // noformat) are block rules; see ATLASSIAN_BLOCK_RULES below.

  // === JQL Injection ===
  {
    pattern: /project\s*(?:=|in)\s*\(\s*\*\s*\)/i,
    severity: "high",
    description: "Atlassian: JQL wildcard project access attempt",
  },
  {
    pattern: /(?:union\s+(?:all\s+)?select\s|;\s*(?:select|drop|delete|insert|update)\s)/i,
    severity: "critical",
    description: "Atlassian: SQL injection attempt in JQL context",
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

/**
 * Block rules: an opening tag, the matching closing tag, and (optionally) a
 * keyword somewhere between them. These run in code rather than as one regex.
 * A single regex either backtracks quadratically on unclosed or repeated tags,
 * or has to stop at loose tokens, which lets `<!-- payload <!-- -->` or a
 * stray `{expanded}` slip through. `findBlock` is linear and matches the real
 * closing tag.
 */
interface BlockRuleDef {
  /** Global regex for the opening tag. Keep it free of unbounded gaps. */
  open: RegExp;
  /**
   * For macros with parameters (`{panel:title=...}`): `open` matches only the
   * name, and the block body starts after the next `}`.
   */
  paramsEndAtBrace?: boolean;
  /** Global regex for the closing tag. */
  close: RegExp;
  /** Tested against the text between the tags. Omit to flag any non-empty block. */
  keywords?: RegExp;
  severity: ThreatIndicator["severity"];
  description: string;
}

const ATLASSIAN_BLOCK_RULES: BlockRuleDef[] = [
  {
    open: /\{color:#(?:ffffff|FFFFFF)\}/g,
    close: /\{color\}/g,
    severity: "high",
    description: "Atlassian: White-text hiding in Confluence color macro",
  },
  {
    open: /\{html\}/gi,
    close: /\{html\}/gi,
    keywords: /display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0/i,
    severity: "critical",
    description: "Atlassian: Hidden content via CSS in Confluence HTML macro",
  },
  {
    open: /<!--/g,
    close: /-->/g,
    keywords: /ignore|disregard|override|instruction|system\s+prompt/i,
    severity: "high",
    description: "Atlassian: Injection payload hidden in HTML comments",
  },
  {
    open: /\{panel(?=[:}])/gi,
    paramsEndAtBrace: true,
    close: /\{panel\}/gi,
    keywords: /ignore\s+previous|system\s+prompt|override\s+instruction/i,
    severity: "critical",
    description: "Atlassian: Injection hidden in Confluence panel macro",
  },
  {
    open: /\{expand(?=[:}])/gi,
    paramsEndAtBrace: true,
    close: /\{expand\}/gi,
    keywords: /ignore|disregard|override/i,
    severity: "high",
    description: "Atlassian: Injection hidden in Confluence expand macro",
  },
  {
    open: /\{noformat\}/gi,
    close: /\{noformat\}/gi,
    keywords: /\[SYSTEM\]|\[INST\]|<<SYS>>|<\|im_start\|>/i,
    severity: "critical",
    description: "Atlassian: LLM delimiters hidden in Confluence noformat block",
  },
];

/**
 * Returns the first opener..closer span whose body matches the rule, or null.
 * Linear: each closer is searched for once, and when a body has no keyword,
 * every later opener before that closer is skipped (its body is a suffix of
 * the one just checked, so it can't contain a keyword either).
 */
export function findBlock(input: string, rule: BlockRuleDef): string | null {
  const open = new RegExp(rule.open.source, rule.open.flags);
  const close = new RegExp(rule.close.source, rule.close.flags);
  let closer: { index: number; end: number } | null = null;
  let brace = -1;

  for (let m = open.exec(input); m; m = open.exec(input)) {
    let bodyStart = m.index + m[0].length;
    if (rule.paramsEndAtBrace) {
      // Cached like the closer: positions only move forward.
      if (brace < bodyStart) brace = input.indexOf("}", bodyStart);
      if (brace === -1) return null;
      bodyStart = brace + 1;
    }
    if (!closer || closer.index < bodyStart) {
      close.lastIndex = bodyStart;
      const c = close.exec(input);
      // No closer after this opener means none after any later opener.
      if (!c) return null;
      closer = { index: c.index, end: c.index + c[0].length };
    }
    const body = input.slice(bodyStart, closer.index);
    const hit = rule.keywords ? rule.keywords.test(body) : body.length > 0;
    if (hit) return input.slice(m.index, closer.end);
    // The closer itself may open the next block (same-token tags like {html}).
    open.lastIndex = Math.max(open.lastIndex, closer.index);
  }
  return null;
}

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

    for (const rule of ATLASSIAN_BLOCK_RULES) {
      const block = findBlock(input, rule);
      if (block !== null) {
        indicators.push({
          strategy: this.name,
          severity: rule.severity,
          description: rule.description,
          fieldPath,
          matchedContent: block.substring(0, 100),
        });
      }
    }

    return indicators;
  }
}
