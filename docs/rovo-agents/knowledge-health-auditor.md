# Rovo Agent — Knowledge Health Auditor

A conversational counterpart to the Dashboard Hub Pro "Knowledge Health" widget. The agent answers ad-hoc questions about space/page health and can propose (or apply, with approval) low-risk remediations inside Confluence and Jira.

Configured in **Rovo Studio** at `https://genxcelerator.atlassian.net` (Atlassian Admin → Rovo → Agents). Follow the steps below to reproduce.

## 1. Agent metadata

| Field | Value |
|---|---|
| Name | `Knowledge Health Auditor` |
| Description | `Audits the health of Confluence knowledge bases and recommends improvements.` |
| Visibility | Workspace (or per-team as desired) |

## 2. System prompt

Paste verbatim in Rovo Studio → Instructions:

```
You are the Knowledge Health Auditor for the genxcelerator knowledge base.
Your job is to help teams keep their Confluence documentation fresh, complete,
and discoverable.

When a user asks about knowledge health, space quality, stale pages, or which
pages need attention, ALWAYS call the `fetchKnowledgeHealth` action first to
get current scores. Never invent scores.

The action returns pages scored 0–100 across four factors:
  - staleness (0–30): days since last modified
  - depth (0–15): hierarchy position
  - commentActivity (0–30): comments + inline discussion
  - wordCount (0–25): content volume
Status buckets: healthy ≥70, needs-attention ≥50, stale ≥30, critical <30.

When recommending actions, prefer LOW-RISK suggestions (comments, draft edits
for human review) over direct page rewrites. When the user confirms an action,
use the appropriate Atlassian tool (createConfluenceFooterComment,
updateConfluencePage) — these go through the security gateway and may require
approval.

Be concise. Cite page titles and scores when you reference pages.
```

## 3. Custom HTTP Action — `fetchKnowledgeHealth`

Rovo Studio → Actions → New Action → HTTP.

| Field | Value |
|---|---|
| Name | `fetchKnowledgeHealth` |
| Description | `Fetches current health scores for a Confluence space.` |
| Method | `GET` |
| URL | `https://partner-enablement-mcp.vercel.app/api/dashboard-hub/knowledge-health` |
| Query params | `spaceKey` (string, default `HA`) |
| Headers | `Authorization: Bearer ${secret.DASHBOARD_HUB_API_TOKEN}` |
| Secret storage | Store the token as an Atlassian Connect secret. **Do not paste it literally into the action config.** |
| Response schema | See contract below. |

Response contract:

```json
{
  "generatedAt": "ISO-8601 timestamp",
  "space": { "key": "HA", "name": "Healthcare AI" },
  "summary": {
    "averageScore": 47,
    "totalPages": 7,
    "healthyCount": 0,
    "needsAttentionCount": 2,
    "staleCount": 5,
    "criticalCount": 0
  },
  "pages": [
    {
      "pageId": "string",
      "title": "string",
      "score": 0,
      "status": "healthy | needs-attention | stale | critical",
      "staleness": 0,
      "depth": 0,
      "commentActivity": 0,
      "wordCount": 0,
      "topRecommendation": "string | null"
    }
  ],
  "source": "gateway | mock"
}
```

## 4. Additional tools to enable

From the already-connected MCP server (the gateway), enable:

- `searchConfluenceUsingCql` — find pages by label, date, text
- `getConfluencePage` — fetch full page content before proposing edits
- `createConfluenceFooterComment` — post review-request comments on stale pages (write, policy-gated)
- `updateConfluencePage` — apply approved updates (write, policy-gated; triggers HITL approval via gateway)
- `createJiraIssue` — file a tech-debt ticket for critical pages (optional, demo polish)

## 5. Starter prompts

Enter these in Rovo Studio → Conversation starters:

- `Audit the Healthcare AI space and list the 5 worst pages`
- `Which pages are stale and need an owner review?`
- `Draft a comment asking the author to review this page`
- `Summarize the overall knowledge health status for the HA space`

## 6. Gateway policy verification

In the gateway admin dashboard, confirm the following before demoing:

1. **Approval for Writes** template is active for the tenant. This makes `updateConfluencePage` and `createConfluenceFooterComment` enter the HITL approval queue — the audit trail is visibly safe.
2. **PII Shield** template is active (or at least the scanner is running) so any PII the agent might surface is redacted on the response path.
3. Audit logs for the agent's tool calls appear in the dashboard with `source=rovo-agent` (or similar).

## 7. Demo script

1. Open Rovo chat, select "Knowledge Health Auditor".
2. Prompt: "Audit the Healthcare AI space and list the 5 worst pages".
3. Agent calls `fetchKnowledgeHealth?spaceKey=HA`, returns a ranked list with scores and factors.
4. Prompt: "Draft a comment on the worst page asking the author to review".
5. Agent calls `createConfluenceFooterComment` → gateway triggers approval → approver in dashboard approves → comment posted in Confluence.
6. Back in Confluence, open the Dashboard Hub page — the updated `commentActivity` factor shows a higher score for that page on the next refresh (15-minute cache).

## 8. Related files

- Endpoint the action calls: `web-demo/src/app/api/dashboard-hub/knowledge-health/route.ts`
- Scoring algorithm: `web-demo/src/lib/health-scoring.ts`
- Env var contract: `CLAUDE.md` → `DASHBOARD_HUB_API_TOKEN`
