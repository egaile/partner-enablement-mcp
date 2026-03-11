# LinkedIn Post Series: Atlassian Rovo MCP + Security Gateway

> **Publishing cadence:** One post every 3-4 days over ~2 weeks
> **Suggested order:** Post 1 → Post 3 → Post 2 → Post 4

---

## Post 1: "I Connected Claude to a Live Jira & Confluence Instance. Here's What I Learned About Atlassian's Rovo MCP."

**Audience:** Atlassian ecosystem, AI practitioners, enterprise architects

---

Three months ago, I set out to answer a question that I think a lot of enterprise teams are quietly asking: *What happens when you connect an AI agent to your actual Jira and Confluence data?*

Not a toy demo. Not mock data. A live Atlassian Cloud instance with real projects, real issues, and real Confluence documentation — running through Atlassian's Rovo MCP server.

I built a web-based demo that simulates an AI agent helping enterprise teams plan Claude deployments, and I want to share what I learned — because the implications for Global System Integrators and enterprise Atlassian customers are significant.

### What is Rovo MCP?

For those unfamiliar: Atlassian's Rovo MCP server exposes 40+ tools through the Model Context Protocol — Anthropic's open standard for structured AI-to-tool communication. These tools let an AI agent read and write to Jira, search Confluence, manage workflows, and more — all through a standardized interface.

Think of it as giving Claude structured, permissioned access to your entire Atlassian ecosystem.

### What I Built

I created two complementary systems:

1. **A web demo** that walks through a 7-step AI agent workflow — from reading a Jira project backlog to generating architecture recommendations to creating implementation tickets. All powered by live Rovo MCP tool calls.

2. **An MCP Security Gateway** that sits between the AI agent and Rovo, enforcing security policies, scanning for prompt injection, detecting PII, and audit-logging every interaction.

The demo runs two industry scenarios: a **healthcare system** deploying a HIPAA-compliant patient intake assistant (integrated with Epic EHR via FHIR), and a **financial services firm** automating loan document processing with SOC2 and PCI-DSS compliance requirements.

### 13 Rovo Tools Across 7 Steps

Here's the journey an agent takes through a single demo run:

**Step 1 — Project Context:** The agent calls `getVisibleJiraProjects` and `searchJiraIssuesUsingJql` to read the project backlog. It extracts compliance signals from issue labels (HIPAA, PCI-DSS), detects integration targets (Epic EHR, FHIR APIs), and identifies data types being handled (PHI, PII, financial data). This isn't pre-programmed — it's reading your actual Jira data.

**Step 2 — Cross-Product Search:** A single call to Rovo's `search` tool returns results from *both* Jira and Confluence simultaneously. The agent finds architecture guides, compliance documentation, and related issues — all in one query. This is something teams manually do across two separate UIs today.

**Step 3 — Project Health:** Four parallel JQL queries assess project readiness: open issues, high-priority items, overdue tickets, and blocked work. The agent computes a readiness score and flags risks like "3 blocked issues may indicate a dependency bottleneck."

**Step 4 — Architecture Recommendation:** Before recommending an architecture pattern, the agent searches Confluence via CQL for existing architecture documentation. It reads your team's actual docs with `getConfluencePage`, then recommends a pattern (like a conversational agent with tool use for the healthcare scenario) that builds on what your team has already documented.

**Step 5 — Compliance Assessment:** The agent searches Confluence for compliance documentation *per framework* — separate CQL queries for HIPAA, SOC2, PCI-DSS. It classifies your documentation coverage as full, partial, or missing, then generates a gap analysis. For the healthcare scenario, it might find your HIPAA Architecture Guide (full coverage) but flag that SOC2 documentation is missing entirely.

**Step 6 — Implementation Plan:** Based on all the context gathered, the agent generates a phased implementation plan with sprint breakdowns, team skill requirements, and Jira ticket templates.

**Step 7 — Agent Write Operations:** This is where it gets interesting. The agent demonstrates 5 write operations: labeling issues via `editJiraIssue`, posting analysis comments via `addCommentToJiraIssue`, transitioning workflows via `transitionJiraIssue`, publishing architecture docs to Confluence via `createConfluencePage`, and batch-creating implementation tickets via `createJiraIssue`.

### What Surprised Me

**Cross-product search is a game-changer.** The ability to query Jira and Confluence in a single Rovo `search` call — and get structured results from both — eliminates the context-switching that kills productivity in enterprise environments. GSIs running deployment engagements across Jira boards and Confluence spaces will immediately feel this.

**The compliance gap analysis writes itself.** When you point an AI agent at your Confluence space and ask "do we have HIPAA documentation?", the answer isn't theoretical — it's based on what CQL actually finds. The agent becomes an automated documentation auditor.

**Write operations need guardrails.** The moment your agent can create Jira tickets, transition workflows, and publish Confluence pages, you need to think about security. Which brings me to my next post in this series — why I built an MCP Security Gateway.

### Why This Matters for GSIs

If you're a Global System Integrator helping enterprises deploy AI, the Atlassian ecosystem is already where your clients live. Their project plans are in Jira. Their architecture docs are in Confluence. Their compliance frameworks are documented in Confluence spaces.

Rovo MCP doesn't just let AI agents *access* this data — it lets them *work within* the existing enterprise workflow. No new tools to learn. No data migration. The AI meets your team where they already are.

I'll be diving deeper into the security architecture, the compliance scenarios, and the lessons learned for enterprise deployment in upcoming posts. If you're exploring MCP for enterprise Atlassian environments, I'd love to hear what questions you're grappling with.

*#MCP #Atlassian #Rovo #EnterpriseAI #Claude #AIAgents #GSI*

---

## Post 2: "An AI Agent Just Audited Our Confluence Space for HIPAA Compliance. Here's How."

**Audience:** Enterprise architects, compliance teams, GSI consultants

---

One of the most powerful things I discovered while building my Atlassian Rovo MCP demo wasn't about AI architecture or prompt engineering. It was about compliance.

Specifically: what happens when you give an AI agent the ability to search your Confluence documentation using CQL queries, then cross-reference what it finds against compliance framework requirements?

The answer: you get an automated documentation auditor that can tell you exactly where your compliance gaps are — in seconds, not weeks.

### The Scenario

In my demo, I built two industry scenarios to test this. Let me walk through the healthcare one, because it illustrates the point clearly.

**The setup:** A 12-hospital health system is deploying an AI-powered patient intake assistant integrated with their Epic EHR via FHIR R4 APIs. The system will handle Protected Health Information (PHI), which means HIPAA compliance isn't optional — it's the foundation everything else sits on.

**The Jira project** contains issues labeled with `hipaa`, `phi`, `epic-ehr`, and `fhir`. The Confluence space has architecture guides, PHI handling procedures, and data classification documentation.

### Step-by-Step: How the Agent Audits Compliance

**1. Context extraction from Jira.** The agent reads the project backlog via `searchJiraIssuesUsingJql` and extracts compliance-relevant labels. When it sees `hipaa` and `phi` on issues, it knows which frameworks to evaluate. This isn't hardcoded — the agent discovers compliance requirements from your actual issue metadata.

**2. Per-framework Confluence search.** For each applicable framework (HIPAA for healthcare; SOC2 and PCI-DSS for financial services), the agent runs a targeted CQL query against Confluence:

- HIPAA search: `type = page AND (text ~ "HIPAA" OR text ~ "PHI" OR text ~ "protected health")`
- SOC2 search: `type = page AND (text ~ "SOC2" OR text ~ "SOC 2" OR text ~ "trust criteria")`
- PCI-DSS search: `type = page AND (text ~ "PCI" OR text ~ "payment card" OR text ~ "cardholder")`

**3. Coverage classification.** Based on what CQL returns:
- **Full coverage** (2+ matching docs): Your documentation addresses this framework substantively
- **Partial coverage** (1 doc): Documentation exists but may have gaps
- **Missing** (0 docs): No Confluence documentation found for this framework

**4. Gap analysis.** The agent cross-references its findings with a compliance knowledge base covering HIPAA Privacy Rule, Security Rule, and Breach Notification requirements. It generates specific recommendations for each gap — not generic advice, but targeted action items informed by what it found (and didn't find) in your Confluence space.

### What the Healthcare Scenario Reveals

In the demo's healthcare scenario, the agent typically finds:

- **HIPAA: Full coverage** — It discovers the "HIPAA Architecture Guide" and "PHI Data Classification Guide" in Confluence. The agent reads these pages with `getConfluencePage` and confirms they cover encryption at rest, access controls, and audit requirements.
- **SOC2: Missing** — No Confluence pages match SOC2 search terms. The agent flags this gap and recommends creating SOC2 documentation, especially given that cloud infrastructure for the FHIR integration will need security controls that map to SOC2 trust criteria.

This is the kind of analysis that typically takes a compliance consultant days of manual review. The agent does it in seconds — and it's based on your actual documentation, not assumptions.

### The Financial Services Angle

The financial services scenario is equally revealing. When a regional bank is deploying AI for loan document processing:

- **SOC2: Partial coverage** — One page found (SOC2 Control Matrix), but the agent notes it may not cover AI-specific controls for automated decision-making.
- **PCI-DSS: Partial coverage** — The PCI-DSS Tokenization Architecture page exists, but the agent flags that AI pipeline considerations (model access to card data, tokenization before inference) aren't documented.

### Beyond Compliance: Architecture-Aware Recommendations

The compliance step doesn't operate in isolation. By this point in the demo flow, the agent has already:

1. Read the full Jira backlog (understanding the project scope)
2. Searched across Jira and Confluence (discovering existing artifacts)
3. Assessed project health (identifying blocked work and overdue items)
4. Recommended an architecture pattern (after reading existing Confluence architecture docs)

So when the compliance assessment identifies gaps, it can make architecture-aware recommendations. For example: "Your HIPAA Architecture Guide documents encryption at rest, but given the recommended conversational agent pattern with FHIR integration, you'll also need to document PHI handling procedures for real-time API calls to Epic — not just stored data."

### Why This Matters

Compliance documentation is often treated as a checkbox exercise — create the docs, file them away, reference them during audits. But when an AI agent can continuously search and evaluate your documentation against framework requirements, compliance becomes a living, queryable system.

For GSIs running enterprise deployments: imagine running this compliance audit at the start of every engagement. Before you write a single line of code, your AI agent has already identified which compliance frameworks apply (from Jira labels), what documentation exists (from Confluence searches), and where the gaps are. That's weeks of discovery work compressed into minutes.

For enterprise architects: this pattern — CQL search per framework, coverage classification, gap analysis — is reusable. It works for any compliance framework your organization tracks in Confluence. GDPR, FedRAMP, CCPA, SOX — the approach is the same.

The key insight: **your Confluence space already contains most of the compliance context an AI agent needs. Rovo MCP just makes it queryable.**

In my next post, I'll cover why all of these powerful capabilities need a security layer — and what I built to provide one.

*#Compliance #HIPAA #SOC2 #Atlassian #Rovo #MCP #EnterpriseAI #GSI*

---

## Post 3: "I Built an MCP Security Gateway Because AI Agents Shouldn't Have Unchecked Access to Your Jira"

**Audience:** CISOs, security architects, enterprise platform teams

---

Here's an uncomfortable truth about the Model Context Protocol: **MCP has no built-in security layer.**

When you connect an AI agent to Atlassian's Rovo MCP server, that agent can read your Jira backlogs, search your Confluence spaces, create issues, transition workflows, and publish pages. The protocol itself doesn't enforce access policies, scan for prompt injection, detect PII in responses, or audit what happened.

This isn't a criticism of MCP — it's a protocol, not a security product. But for enterprise deployments, this gap is a showstopper. So I built an MCP Security Gateway to close it.

### The Problem I Was Trying to Solve

While building my Atlassian Rovo MCP demo (which I wrote about in my first post), I realized that every Rovo tool call — reading a Jira issue, searching Confluence, creating a ticket — was essentially unaudited, unpolicied, and unscanned.

In an enterprise environment, that means:
- **No access control:** Which teams can use which tools? Can an agent in the marketing department read HR project issues?
- **No injection defense:** Jira issue descriptions are user-generated content. A malicious actor could embed prompt injection payloads in issue descriptions that an AI agent would read and execute.
- **No PII protection:** Jira issues and Confluence pages routinely contain SSNs, email addresses, medical record numbers, and financial data. An AI agent reading these could inadvertently expose PII in its responses.
- **No audit trail:** When an AI agent creates 50 Jira tickets or publishes a Confluence page, who approved it? When did it happen? Was anything blocked?

### What the Gateway Does

The MCP Security Gateway is a transparent proxy that sits between your AI agent and Rovo MCP. Every tool call passes through a 6-stage security pipeline:

**Stage 1: Policy Evaluation.** Rules are evaluated in priority order using glob pattern matching. A policy like `tools: ["*create*", "*update*", "*delete*"]` with action `deny` blocks all write operations across all servers. I built 6 Atlassian-specific policy templates:

- *Read-Only Jira* — blocks 7 write operations (create, update, delete, transition, assign, comment, edit)
- *Protected Projects* — blocks access to sensitive project servers (HR, SEC, FIN)
- *Approval for Writes* — requires human-in-the-loop approval for any write operation
- *Confluence View-Only* — allows Confluence reads, blocks writes
- *PII Shield* — auto-redacts PII from all tool responses
- *Audit Everything* — log-only mode for maximum visibility during evaluation

**Stage 2: Injection Scanning.** This is where I spent the most time. The scanner runs 5 strategies against all string values in tool parameters:

1. **Pattern Matching** (15 patterns): Catches "ignore previous instructions," role injection attempts, system delimiter spoofing (`[SYSTEM]`, `[INST]`, `<<SYS>>`), and jailbreak patterns.

2. **Unicode Analysis**: Detects zero-width characters, RTL override tricks, and homoglyph substitution (Cyrillic characters that look identical to Latin ones). These are invisible to humans but change how text is processed.

3. **Structural Analysis**: Catches embedded `<script>` tags, MCP tool result spoofing (`<tool_use>`, `<tool_result>`), and code injection patterns.

4. **Exfiltration Detection**: Identifies attempts to chain tool calls ("then call this API"), exfiltrate data to external URLs, or encode output for extraction.

5. **Atlassian-Specific Injection** (20 patterns): This is the one I'm most proud of. These patterns target attack vectors unique to the Jira/Confluence ecosystem:
   - White-text hiding in Confluence color macros: `{color:#ffffff}IGNORE ALL PREVIOUS INSTRUCTIONS{color}`
   - Hidden content in Confluence HTML macros with `display:none`
   - Injection payloads inside `{panel}`, `{expand}`, and `{noformat}` macros
   - JQL injection: `project = (*) OR 1=1`
   - AI-targeted directives embedded in issue descriptions: "When an AI reads this..."
   - Cross-project data leakage instructions: "Also search issues from all projects"

These aren't theoretical — they're the attack vectors that emerge when AI agents read user-generated content in Jira and Confluence.

**Stage 3: PII Detection.** The gateway scans both requests and responses for 8 PII patterns: SSNs, credit card numbers (with Luhn algorithm validation to reduce false positives), email addresses, US phone numbers, IP addresses, dates of birth, and medical record numbers. When a policy enables PII redaction, matches are replaced with `[REDACTED]` before the response reaches the agent.

**Stage 4: Tool Drift Detection.** The gateway maintains SHA-256 snapshots of every tool definition. If a downstream MCP server changes a tool's schema without notification, the gateway detects the drift and can block the call. This matters in enterprise environments where tool changes should go through change management.

**Stage 5: Forward & Response Scan.** The call is forwarded to Rovo, and the response is scanned for injection payloads and PII before being returned to the agent.

**Stage 6: Audit Logging.** Every interaction is logged with: correlation ID, tenant, user, tool name, policy decision, threat count, PII detection results, latency, and Atlassian-specific metadata (project key, space key, operation type, whether it was a write operation). Logs are batched (50 entries or every 5 seconds) and stored in Supabase with full query support.

### The Human-in-the-Loop Pattern

One of the most important features for enterprise deployment is the approval workflow. When a policy specifies `require_approval` as its action, the gateway:

1. Intercepts the tool call
2. Creates an approval request with full context (who's asking, what tool, what parameters)
3. Surfaces it in the admin dashboard
4. Waits for an admin to approve or reject
5. Only forwards the call on approval

This is essential for write operations in production. An AI agent shouldn't be able to create Jira tickets in your production project without human oversight — at least not until you've built sufficient trust and policy coverage.

### The Admin Dashboard

Because security infrastructure is only useful if people can manage it, I also built an admin dashboard with: server management (with OAuth 2.1 for Atlassian), policy creation and simulation, a real-time audit log with filters, an alert feed for security events, an approval queue for pending write operations, and a tool inventory showing all 40+ Rovo tools with their namespacing.

### What I Learned

**The Atlassian-specific patterns matter most.** Generic prompt injection detection catches the obvious attacks, but the Confluence macro-based hiding techniques and JQL injection patterns are specific to how Atlassian formats content. Enterprise security teams need specialized detection for their specific tool ecosystem.

**PII in Jira is more common than you think.** In any enterprise Jira instance, issue descriptions and comments routinely contain email addresses, phone numbers, and in healthcare contexts, medical record numbers. Without PII scanning, every AI agent reading Jira is a potential data exposure vector.

**Audit logging isn't optional — it's the foundation.** Every compliance framework (HIPAA, SOC2, PCI-DSS) requires audit trails for automated data access. Without a gateway logging every tool call, you can't demonstrate compliance. With it, you have a complete, queryable record of every AI-to-Atlassian interaction.

Building this gateway taught me that MCP is a powerful protocol, but enterprise adoption requires a security layer that understands both the protocol and the specific tools being accessed. Generic API security isn't enough — you need Atlassian-aware security for Atlassian tools.

*#MCP #Security #Atlassian #Rovo #EnterpriseAI #CISO #CyberSecurity #AIGovernance*

---

## Post 4: "What Enterprise AI Teams Can Learn from Connecting Claude to Atlassian — and What Comes Next"

**Audience:** AI strategy leaders, Atlassian ecosystem, forward-looking builders

---

Over the past few months, I've been building a system that connects Claude to a live Atlassian Jira and Confluence instance through Rovo MCP, with a security gateway in between. I've written about the demo, the compliance capabilities, and the security architecture in earlier posts.

Now I want to step back and share the bigger lessons — because I think they apply to anyone thinking about enterprise AI deployment, whether you use Atlassian or not.

### Lesson 1: Your Enterprise Data Is Already Structured — You Just Need a Protocol to Access It

Before MCP, connecting an AI agent to Jira meant building custom API integrations, handling authentication, parsing response formats, and managing rate limits. Each integration was bespoke.

MCP changes this equation fundamentally. Atlassian's Rovo MCP server exposes 40+ tools through a standardized interface. An AI agent doesn't need to know about Jira's REST API v3 or Confluence's content format — it calls `searchJiraIssuesUsingJql` and gets structured results.

But here's the insight that surprised me: **the data your enterprise already has in Jira and Confluence is far more valuable to AI agents than most teams realize.**

When my demo agent reads a Jira backlog, it doesn't just see issue titles. It extracts compliance signals from labels, identifies integration targets from descriptions, detects data types being handled, and assesses project health from status distributions. All of this context already exists in your Jira instance — it's just not being leveraged by AI today.

The same is true for Confluence. Your architecture decision records, compliance documentation, onboarding guides, and runbooks are all queryable via CQL. An AI agent that can search and read Confluence becomes an instant organizational knowledge synthesizer.

### Lesson 2: Read Operations Are Table Stakes — Write Operations Are Where the Value (and Risk) Lives

Most MCP demos I've seen focus on read operations: search Jira, read Confluence pages, fetch project details. These are useful, but they're the easy part.

The real value — and the real risk — comes from write operations. In my demo, the agent:
- Labels Jira issues based on its compliance analysis
- Posts AI-generated analysis comments on key issues
- Transitions workflow statuses as implementation progresses
- Publishes architecture documentation to Confluence
- Creates implementation plan tickets with sprint assignments

Each of these operations saves significant human time. But each one also carries risk. A misconfigured agent could mislabel issues, spam comments, prematurely close workflows, or publish incorrect documentation.

This is why I built the security gateway with policy-based controls specifically for write operations. The `Approval for Writes` policy template, for example, intercepts any write operation and requires human approval before execution. It's the difference between "the AI did everything while we were in a meeting" and "the AI prepared everything and we approved it."

**For GSIs, this is the key selling point:** you can show enterprise clients a workflow where AI does the heavy lifting, but humans maintain control over what actually changes in their production systems.

### Lesson 3: Compliance Isn't a Bolt-On — It's a Design Constraint

When I built the HIPAA-compliant healthcare scenario and the SOC2/PCI-DSS financial services scenario, I realized something: compliance requirements fundamentally shape the architecture.

HIPAA doesn't just mean "encrypt the data." It means:
- Every AI access to PHI must be audit-logged with 6-year retention
- The AI agent needs a Business Associate Agreement context
- PHI in AI responses must be detectable and redactable
- Human-in-the-loop review is required for clinical decision support

SOC2 doesn't just mean "add access controls." It means:
- Segregation of duties — the agent that creates tickets shouldn't also approve them
- Change management — tool definition changes must be detected and reviewed
- Continuous monitoring — the security pipeline must run on every call, not just spot checks

These requirements aren't things you add after building the system. They're constraints that determine how the system works from day one. The MCP Security Gateway's 6-stage pipeline, PII detection, and audit logging aren't features — they're compliance requirements made operational.

### Lesson 4: GSIs Are Uniquely Positioned for This

Global System Integrators who already use Atlassian for their deployment work have a massive advantage in the emerging AI agent landscape:

**They know the enterprise's Atlassian setup.** Project structures, Confluence spaces, workflow configurations, permission schemes — GSIs already understand the client's Atlassian topology.

**They manage the deployment lifecycle in Jira.** Sprint planning, issue tracking, release management — the entire engagement is already instrumented. An AI agent that can read and write to this system accelerates every phase.

**They own the compliance conversation.** GSIs are often responsible for ensuring deployments meet regulatory requirements. An AI agent that can audit Confluence documentation against compliance frameworks gives them a powerful tool for discovery and gap analysis.

**They can demonstrate value immediately.** Imagine starting a new engagement by pointing an AI agent at the client's Jira project. Within minutes, you have: project health assessment, compliance gap analysis, architecture recommendations informed by existing Confluence documentation, and a draft implementation plan with Jira tickets. That's the first week of a traditional engagement, compressed into an afternoon.

### What Comes Next

I think we're at the very beginning of enterprise MCP adoption. Here's what I expect to see:

**MCP security becomes a category.** Today, there's no standard for MCP security. Every enterprise deploying MCP-connected agents will need policy enforcement, injection scanning, PII detection, and audit logging. Whether that's a gateway (like what I built), a sidecar, or a built-in MCP feature, the need is clear and urgent.

**Atlassian-native AI workflows will emerge.** Rovo MCP isn't just a data access layer — it's a workflow automation platform. The combination of structured Jira workflows and AI decision-making will create new patterns for project management, compliance monitoring, and knowledge management.

**Compliance-as-code for AI agents will become standard.** The pattern of "search documentation, classify coverage, identify gaps, generate remediation tasks" that I demonstrated for HIPAA and SOC2 will be templated and productized. Enterprises will expect their AI agents to continuously monitor compliance posture, not just check it once during setup.

### Try It Yourself

Everything I've built — the web demo, the security gateway, the admin dashboard — is available as open source. If you're exploring how to connect AI agents to enterprise systems through MCP, or if you're thinking about the security implications of doing so, I'd welcome the conversation.

The enterprise AI space is moving fast, but the fundamentals — security, compliance, audit trails, human oversight — don't change. They just need to be implemented for a new paradigm.

*#MCP #Atlassian #EnterpriseAI #Claude #AIStrategy #GSI #ThoughtLeadership*
