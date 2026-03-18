import { NextResponse } from 'next/server';

// ---- Inline scanner implementation (pure TS, no external deps) ----
// Re-implements gateway scanner logic to avoid cross-package .js extension issues

interface ThreatIndicator {
  strategy: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  fieldPath: string;
  matchedContent?: string;
}

interface ThreatScanResult {
  clean: boolean;
  indicators: ThreatIndicator[];
  highestSeverity: ThreatIndicator['severity'] | null;
  scanDurationMs: number;
}

interface PiiMatch {
  type: string;
  fieldPath: string;
  start: number;
  end: number;
}

interface ScanStrategy {
  name: string;
  scan(input: string, fieldPath: string): ThreatIndicator[];
}

// ---- Pattern Match Strategy ----
const INJECTION_PATTERNS: Array<{ pattern: RegExp; severity: ThreatIndicator['severity']; description: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i, severity: 'critical', description: 'Attempts to override prior instructions' },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?|guidelines?)/i, severity: 'critical', description: 'Attempts to disregard system instructions' },
  { pattern: /forget\s+(everything|all|your)\s+(you\s+)?(know|were\s+told|instructions?)/i, severity: 'critical', description: 'Attempts to reset system context' },
  { pattern: /you\s+are\s+(now|a|an)\s+/i, severity: 'high', description: 'Attempts role injection via identity reassignment' },
  { pattern: /act\s+as\s+(if\s+you\s+are|a|an|my)\s+/i, severity: 'high', description: 'Attempts role injection via behavioral override' },
  { pattern: /pretend\s+(you\s+are|to\s+be)\s+/i, severity: 'high', description: 'Attempts role injection via pretense' },
  { pattern: /switch\s+to\s+.*mode/i, severity: 'high', description: 'Attempts to change operational mode' },
  { pattern: /what\s+(are|is)\s+your\s+(system\s+)?(instructions?|prompts?|rules?)/i, severity: 'medium', description: 'Attempts to extract system prompt' },
  { pattern: /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?)/i, severity: 'medium', description: 'Attempts to reveal system prompt' },
  { pattern: /\[SYSTEM\]/i, severity: 'critical', description: 'Contains system-level delimiter injection' },
  { pattern: /\[INST\]/i, severity: 'critical', description: 'Contains instruction delimiter injection' },
  { pattern: /<<\s*SYS\s*>>/i, severity: 'critical', description: 'Contains Llama-style system delimiter' },
  { pattern: /<\|im_start\|>/i, severity: 'critical', description: 'Contains ChatML delimiter injection' },
  { pattern: /DAN\s*(mode|prompt|jailbreak)/i, severity: 'critical', description: 'Contains DAN jailbreak pattern' },
  { pattern: /developer\s+mode\s+(enabled|activated|on)/i, severity: 'critical', description: 'Contains developer mode jailbreak' },
];

class PatternMatchStrategy implements ScanStrategy {
  name = 'pattern_match';
  scan(input: string, fieldPath: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];
    for (const { pattern, severity, description } of INJECTION_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        indicators.push({ strategy: this.name, severity, description, fieldPath, matchedContent: match[0].substring(0, 100) });
      }
    }
    return indicators;
  }
}

// ---- Unicode Analysis Strategy ----
const ZERO_WIDTH_CHARS = [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad];
const RTL_OVERRIDES = [0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069];
const HOMOGLYPH_RANGES = [
  { start: 0x0400, end: 0x04ff, name: 'Cyrillic' },
  { start: 0x0370, end: 0x03ff, name: 'Greek' },
  { start: 0xff01, end: 0xff5e, name: 'Fullwidth' },
];

class UnicodeAnalysisStrategy implements ScanStrategy {
  name = 'unicode_analysis';
  scan(input: string, fieldPath: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];
    const zeroWidthFound: string[] = [];
    for (const char of input) {
      const code = char.codePointAt(0);
      if (code !== undefined && ZERO_WIDTH_CHARS.includes(code)) {
        zeroWidthFound.push(`U+${code.toString(16).padStart(4, '0')}`);
      }
    }
    if (zeroWidthFound.length > 0) {
      indicators.push({ strategy: this.name, severity: 'critical', description: `Contains ${zeroWidthFound.length} invisible zero-width character(s): ${Array.from(new Set(zeroWidthFound)).join(', ')}`, fieldPath });
    }
    const rtlFound: string[] = [];
    for (const char of input) {
      const code = char.codePointAt(0);
      if (code !== undefined && RTL_OVERRIDES.includes(code)) {
        rtlFound.push(`U+${code.toString(16).padStart(4, '0')}`);
      }
    }
    if (rtlFound.length > 0) {
      indicators.push({ strategy: this.name, severity: 'critical', description: `Contains ${rtlFound.length} bidirectional override character(s): ${Array.from(new Set(rtlFound)).join(', ')}`, fieldPath });
    }
    const latinChars = (input.match(/[a-zA-Z]/g) ?? []).length;
    if (latinChars > 5) {
      for (const range of HOMOGLYPH_RANGES) {
        let count = 0;
        for (const char of input) {
          const code = char.codePointAt(0);
          if (code !== undefined && code >= range.start && code <= range.end) count++;
        }
        if (count > 0 && count < latinChars) {
          indicators.push({ strategy: this.name, severity: 'high', description: `Mixed scripts detected: ${count} ${range.name} character(s) in primarily Latin text (possible homoglyph attack)`, fieldPath });
        }
      }
    }
    return indicators;
  }
}

// ---- Structural Strategy ----
const STRUCTURAL_PATTERNS: Array<{ pattern: RegExp; severity: ThreatIndicator['severity']; description: string }> = [
  { pattern: /<script[\s>]/i, severity: 'critical', description: 'Contains embedded script tag' },
  { pattern: /<iframe[\s>]/i, severity: 'critical', description: 'Contains embedded iframe tag' },
  { pattern: /<system>/i, severity: 'critical', description: 'Contains <system> markup (potential prompt structure injection)' },
  { pattern: /<tool_result>/i, severity: 'critical', description: 'Contains <tool_result> markup (potential MCP response spoofing)' },
  { pattern: /<tool_use>/i, severity: 'critical', description: 'Contains <tool_use> markup (potential MCP tool invocation spoofing)' },
  { pattern: /<assistant>/i, severity: 'high', description: 'Contains <assistant> markup (potential role injection)' },
  { pattern: /\{\s*"(?:role|content|function_call|tool_calls?)"\s*:/i, severity: 'high', description: 'Contains JSON structure resembling chat message or tool call' },
  { pattern: /!\[.*\]\(javascript:/i, severity: 'critical', description: 'Contains markdown image with javascript: protocol' },
];

class StructuralStrategy implements ScanStrategy {
  name = 'structural';
  scan(input: string, fieldPath: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];
    for (const { pattern, severity, description } of STRUCTURAL_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        indicators.push({ strategy: this.name, severity, description, fieldPath, matchedContent: match[0].substring(0, 100) });
      }
    }
    return indicators;
  }
}

// ---- Exfiltration Strategy ----
const EXEMPT_DOMAINS = [/\.atlassian\.net$/i, /\.atlassian\.com$/i, /\.atl-paas\.net$/i];
function isExemptUrl(url: string): boolean {
  try { return EXEMPT_DOMAINS.some((re) => re.test(new URL(url).hostname)); } catch { return false; }
}
const EXFILTRATION_PATTERNS: Array<{ pattern: RegExp; severity: ThreatIndicator['severity']; description: string }> = [
  { pattern: /https?:\/\/[^\s"'<>]{10,}/gi, severity: 'info', description: 'Contains URL that could be used for data exfiltration' },
  { pattern: /(?:then|after\s+that|next|also|additionally)\s+(?:call|use|invoke|run|execute)\s+(?:the\s+)?(?:tool|function|command)/i, severity: 'high', description: 'Contains tool chaining instructions (potential multi-step attack)' },
  { pattern: /(?:send|transmit|post|upload|forward|exfiltrate|leak)\s+(?:the\s+)?(?:data|results?|output|response|information|contents?)\s+(?:to|via|through)/i, severity: 'critical', description: 'Contains data exfiltration instructions' },
  { pattern: /(?:webhook|callback|notify)\s*(?:url|endpoint|address)/i, severity: 'high', description: 'Contains webhook/callback reference (potential exfiltration channel)' },
  { pattern: /\.(?:burpcollaborator\.net|oastify\.com|interact\.sh|requestbin\.com|pipedream\.com)/i, severity: 'critical', description: 'Contains known data exfiltration service domain' },
];

class ExfiltrationStrategy implements ScanStrategy {
  name = 'exfiltration';
  scan(input: string, fieldPath: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];
    for (const { pattern, severity, description } of EXFILTRATION_PATTERNS) {
      pattern.lastIndex = 0;
      const match = input.match(pattern);
      if (match) {
        const matchedContent = match[0].substring(0, 100);
        if (description.includes('URL') && isExemptUrl(match[0])) continue;
        indicators.push({ strategy: this.name, severity, description, fieldPath, matchedContent });
      }
    }
    return indicators;
  }
}

// ---- Atlassian Injection Strategy ----
const ATLASSIAN_PATTERNS: Array<{ pattern: RegExp; severity: ThreatIndicator['severity']; description: string }> = [
  { pattern: /(?:^|\n)\s*(?:@ai|@agent|@assistant|@claude|@copilot)\s*[:\-]\s*/im, severity: 'high', description: 'Atlassian: AI agent directive embedded in content' },
  { pattern: /(?:when\s+(?:an?\s+)?(?:ai|agent|assistant|bot)\s+reads?\s+this)/i, severity: 'critical', description: 'Atlassian: Conditional trigger targeting AI agent readers' },
  { pattern: /(?:if\s+you\s+are\s+(?:an?\s+)?(?:ai|agent|assistant|llm|bot))/i, severity: 'critical', description: 'Atlassian: Conditional logic targeting AI identity' },
  { pattern: /(?:important\s+instruction|hidden\s+instruction|secret\s+instruction)\s*(?:for|to)\s+(?:the\s+)?(?:ai|agent|assistant)/i, severity: 'critical', description: 'Atlassian: Explicit hidden instruction for AI agents' },
  { pattern: /\{color:#(?:ffffff|FFFFFF)\}[\s\S]+?\{color\}/, severity: 'high', description: 'Atlassian: White-text hiding in Confluence color macro' },
  { pattern: /\{html\}[\s\S]*?(?:display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0)[\s\S]*?\{html\}/i, severity: 'critical', description: 'Atlassian: Hidden content via CSS in Confluence HTML macro' },
  { pattern: /<!--[\s\S]*?(?:ignore|disregard|override|instruction|system\s+prompt)[\s\S]*?-->/i, severity: 'high', description: 'Atlassian: Injection payload hidden in HTML comments' },
  { pattern: /project\s*(?:=|in)\s*\(\s*\*\s*\)/i, severity: 'high', description: 'Atlassian: JQL wildcard project access attempt' },
  { pattern: /(?:union\s+(?:all\s+)?select\s|;\s*(?:select|drop|delete|insert|update)\s)/i, severity: 'critical', description: 'Atlassian: SQL injection attempt in JQL context' },
  { pattern: /(?:assignee|reporter)\s*(?:=|!=|in)\s*(?:membersOf|currentUser)\s*\(\s*\)\s*(?:or|OR)\s*(?:1\s*=\s*1|true)/i, severity: 'critical', description: 'Atlassian: JQL logic bypass via tautology' },
  { pattern: /(?:also|then|next|additionally)\s+(?:search|find|get|read|list|fetch)\s+(?:issues?|tickets?|pages?)\s+(?:from|in)\s+(?:all|every|other)\s+projects?/i, severity: 'high', description: 'Atlassian: Cross-project data access instruction' },
];

class AtlassianInjectionStrategy implements ScanStrategy {
  name = 'atlassian_injection';
  scan(input: string, fieldPath: string): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];
    for (const { pattern, severity, description } of ATLASSIAN_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        indicators.push({ strategy: this.name, severity, description, fieldPath, matchedContent: match[0].substring(0, 100) });
      }
    }
    return indicators;
  }
}

// ---- PII Scanner ----
const PII_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'credit_card', pattern: /\b(?:\d[ -]*?){13,19}\b/g },
  { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  { type: 'phone', pattern: /\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g },
  { type: 'ip_address', pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g },
  { type: 'date_of_birth', pattern: /\b(?:0[1-9]|1[0-2])[/.-](?:0[1-9]|[12]\d|3[01])[/.-](?:19|20)\d{2}\b/g },
  { type: 'medical_record', pattern: /\bMRN[:\s#-]*\d{4,12}\b/gi },
];

function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

function scanForPii(text: string, fieldPath: string = 'payload'): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const { type, pattern } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (type === 'credit_card' && !luhnCheck(match[0])) continue;
      matches.push({ type, fieldPath, start: match.index, end: match.index + match[0].length });
    }
  }
  return matches;
}

function redactPii(text: string): string {
  let result = text;
  for (const { pattern } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

// ---- Composite Scanner ----
const SEVERITY_ORDER: ThreatIndicator['severity'][] = ['critical', 'high', 'medium', 'low', 'info'];
const strategies: ScanStrategy[] = [
  new PatternMatchStrategy(),
  new UnicodeAnalysisStrategy(),
  new StructuralStrategy(),
  new ExfiltrationStrategy(),
  new AtlassianInjectionStrategy(),
];

function scanPayload(payload: string, fieldPath: string = 'params.payload'): ThreatScanResult {
  const startTime = performance.now();
  const indicators: ThreatIndicator[] = [];
  for (const strategy of strategies) {
    indicators.push(...strategy.scan(payload, fieldPath));
  }
  const scanDurationMs = performance.now() - startTime;
  let highestSeverity: ThreatIndicator['severity'] | null = null;
  for (const severity of SEVERITY_ORDER) {
    if (indicators.some((i) => i.severity === severity)) { highestSeverity = severity; break; }
  }
  return { clean: indicators.length === 0, indicators, highestSeverity, scanDurationMs };
}

function shouldBlock(result: ThreatScanResult): boolean {
  return result.highestSeverity === 'critical' || result.highestSeverity === 'high';
}

// ---- API Route ----
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { payload, mode } = body as { payload: string; mode?: 'scan' | 'pii' | 'redact' };

    if (!payload || typeof payload !== 'string') {
      return NextResponse.json({ error: 'payload is required' }, { status: 400 });
    }

    if (mode === 'redact') {
      return NextResponse.json({ redactedText: redactPii(payload) });
    }

    // Run both scans
    const threats = scanPayload(payload);
    const piiMatches = scanForPii(payload);
    const pii = { detected: piiMatches.length > 0, matches: piiMatches };

    return NextResponse.json({
      threats,
      pii,
      shouldBlock: shouldBlock(threats) || pii.detected,
      redactedText: pii.detected ? redactPii(payload) : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
