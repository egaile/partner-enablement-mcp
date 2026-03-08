# Injection Detection

The gateway's `PromptInjectionScanner` runs five independent scanning strategies against every string value in tool call parameters. Each strategy produces zero or more `ThreatIndicator` results with a severity level. If any indicator reaches `critical` or `high` severity, the request is blocked.

## How scanning works

1. **String extraction**: The scanner recursively walks all tool parameters, extracting every string value with its JSON path (e.g., `params.query`, `params.options[0].text`).
2. **Strategy execution**: Each extracted string is passed through all four strategies.
3. **Aggregation**: All threat indicators are collected. The highest severity across all indicators determines the overall result.
4. **Blocking decision**: `critical` or `high` severity blocks the request. `medium`, `low`, and `info` are logged but the request proceeds.

## Strategy 1: Pattern Match

**Class:** `PatternMatchStrategy`

Scans for known prompt injection phrases using regular expressions. This is the primary defense against direct instruction override attacks.

### Detection categories

**Critical severity:**
- Instruction overrides: "ignore all previous instructions", "disregard your rules", "forget everything you know"
- Delimiter injection: `[SYSTEM]`, `[INST]`, `<<SYS>>`, `<|im_start|>` (ChatML)
- Jailbreak patterns: "DAN mode", "developer mode enabled"

**High severity:**
- Role injection: "you are now a...", "act as if you are...", "pretend to be..."
- Mode switching: "switch to ... mode"

**Medium severity:**
- Prompt extraction: "what are your system instructions", "reveal your prompt", "print your initial message"

### Examples

| Input | Severity | Description |
|-------|----------|-------------|
| `"Ignore all previous instructions and..."` | Critical | Instruction override |
| `"<\|im_start\|>system"` | Critical | ChatML delimiter |
| `"You are now a helpful assistant that..."` | High | Role injection |
| `"What are your system instructions?"` | Medium | Prompt extraction |

## Strategy 2: Unicode Analysis

**Class:** `UnicodeAnalysisStrategy`

Detects invisible and deceptive Unicode characters that can hide malicious content from human review while still being processed by AI models.

### Detection categories

**Critical severity:**
- **Zero-width characters**: U+200B (Zero Width Space), U+200C (Zero Width Non-Joiner), U+200D (Zero Width Joiner), U+2060 (Word Joiner), U+FEFF (BOM), U+00AD (Soft Hyphen)
- **Bidirectional overrides**: U+200E-200F (LTR/RTL marks), U+202A-202E (embedding/override), U+2066-2069 (isolates)

**High severity:**
- **Mixed-script homoglyphs**: Cyrillic, Greek, or fullwidth characters mixed into primarily Latin text. For example, using Cyrillic "а" (U+0430) in place of Latin "a" (U+0061) to bypass keyword filters.

### Why this matters

An attacker could embed `"ignore\u200Ball\u200Bprevious\u200Binstructions"` in a parameter. The text appears as "ignoreallpreviousinstructions" to a human reviewer but may be tokenized differently by an LLM, potentially matching the original injection pattern. The Unicode strategy catches the hidden characters before the pattern matcher even runs.

## Strategy 3: Structural Analysis

**Class:** `StructuralStrategy`

Detects embedded markup and code structures that could manipulate the AI's interpretation of the content.

### Detection categories

**Critical severity:**
- `<script>`, `<iframe>` tags -- code execution attempts
- `<system>` tag -- prompt structure injection
- `<tool_result>`, `<tool_use>` tags -- MCP response/invocation spoofing
- Markdown links/images with `javascript:` protocol

**High severity:**
- `<object>`, `<embed>` tags
- `<assistant>` tag -- role injection via markup
- Code blocks with dangerous operations (`exec()`, `eval()`, `system()`)
- JSON structures resembling chat messages (`{"role": "...", "content": "..."}`) or tool calls

**Medium severity:**
- `<user>` tag -- message boundary injection

### Why this matters

MCP tool responses flow back into the AI's context. If a downstream server response contains `<tool_result>` markup, the AI might interpret it as a real tool result. The structural strategy blocks this at the parameter level (scanning both requests and responses).

## Strategy 4: Exfiltration Detection

**Class:** `ExfiltrationStrategy`

Detects patterns that indicate an attempt to transmit data to external endpoints or chain tools for data theft.

### Detection categories

**Critical severity:**
- Data transmission instructions: "send the data to...", "exfiltrate the results via..."
- Known exfiltration domains: `*.burpcollaborator.net`, `*.oastify.com`, `*.interact.sh`, `*.requestbin.com`, `*.pipedream.com`

**High severity:**
- Tool chaining instructions: "then call the tool...", "next execute the function..."
- Webhook/callback references: "webhook url", "callback endpoint"
- Encoding/obfuscation instructions: "base64 encode the data", "encrypt the output"

**Medium severity:**
- URLs in unexpected fields (could be exfiltration targets)
- IP addresses (potential direct exfiltration)

**Low severity:**
- Email addresses (potential exfiltration targets)

## Strategy 5: Atlassian Injection Detection

**Class:** `AtlassianInjectionStrategy`

Detects injection attempts specifically targeting Atlassian tools. This strategy includes 20 patterns tuned for Jira and Confluence content vectors.

### Detection categories

**Critical severity:**
- JQL injection: piggybacked SQL statements (`union select`, `; DROP TABLE`) appended to JQL queries
- CQL injection: malicious CQL targeting Confluence search
- Confluence page content injection: `<ac:structured-macro>` or `<ac:rich-text-body>` tags in page content parameters
- Jira description injection: system prompt overrides embedded in issue descriptions or comments

**High severity:**
- Workflow transition manipulation: attempts to bypass workflow restrictions via crafted transition parameters
- Permission escalation: references to admin-level operations in non-admin tool calls
- Cross-project data access: patterns indicating attempts to access projects outside the intended scope

**Medium severity:**
- Unusual field combinations in issue updates
- Embedded URLs in Jira fields that match known exfiltration patterns

### Why this matters

Atlassian tools process user-generated content from Jira issues and Confluence pages. An attacker could embed injection payloads in an issue description, and when an AI agent reads that issue via `getJiraIssue`, the payload flows into the agent's context. This strategy catches Atlassian-specific attack vectors before the content reaches the AI.

## Severity levels and blocking behavior

| Severity | Blocked? | Alert fired? | Audit logged? |
|----------|----------|-------------|---------------|
| Critical | Yes | Yes (`injection_detected`, severity: critical) | Yes |
| High | Yes | Yes (`injection_detected`, severity: high) | Yes |
| Medium | No | No (logged in audit entry) | Yes |
| Low | No | No (logged in audit entry) | Yes |
| Info | No | No (logged in audit entry) | Yes |

## Response scanning

The same scanner also runs on downstream server responses. After a tool call returns, the gateway scans all text content in the response. Response threats are logged in the audit entry (`threatsDetected` count includes both request and response indicators) and a console warning is emitted, but response threats do not retroactively block the response since it has already been generated.

## Scan performance

The scanner is designed to be fast. Each scan typically completes in under 10 milliseconds. The `scanDurationMs` field in threat results tracks the actual scan time. This overhead is minimal compared to downstream server latency.

## Limitations

- **Evasion by paraphrasing**: The pattern matcher uses fixed regex patterns. Novel injection phrasing that does not match any pattern will not be detected.
- **Token-level attacks**: Attacks that operate at the token level rather than the string level may bypass string-based scanning.
- **Semantic attacks**: The scanner does not understand the semantic meaning of text. Carefully crafted benign-looking text that has adversarial intent may pass through.
- **Image/binary content**: Only string values are scanned. Binary or image content in tool parameters is not analyzed.

The scanner is a defense-in-depth layer. It should be combined with policy restrictions (deny by default, allowlist approved tools) and HITL approvals for high-risk operations.
