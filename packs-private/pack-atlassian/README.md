# @mcpshield/pack-atlassian (commercial)

The Atlassian (Jira + Confluence) industry pack for [MCPShield](../../README.md). **Commercial license required** — see [`LICENSE`](LICENSE).

## What it contributes

- **`AtlassianInjectionStrategy`** — 20+ scanner patterns targeting prompt-injection payloads embedded in Jira issue descriptions, comments, Confluence pages, and Compass content. Catches AI-directive markers (`@ai:`, `@assistant:`), invisible-text tricks (`{color:#ffffff}...{color}`), conditional triggers (`if you are an AI...`), and hidden-instruction phrasing.
- **Audit enricher** — adds `threatDetails.atlassian = { projectKey, issueKey, spaceKey, pageId, operationType, isWriteOperation }` on every Atlassian tool call, parsed from `params.issueKey`/`spaceKey`/JQL and from the tool name (`jira_create_issue` → `create_issue`, etc.).
- **6 policy templates**:
  - **Read-Only Jira** — deny write tools, allow reads
  - **Protected Projects** — deny servers matching `*HR*`, `*SEC*`, `*FIN*`
  - **Approval for Writes** — `require_approval` on Jira + Confluence write tools
  - **Confluence View-Only** — deny page writes, allow reads
  - **Audit Everything** — `log_only` baseline for compliance evidence
  - **PII Shield** — `redactPII: true` on all Atlassian tool I/O
- **Exfiltration exempt domains** — `*.atlassian.net`, `*.atlassian.com`, `*.atl-paas.net` so legitimate Jira/Confluence URLs in tool responses don't trip the URL-exfiltration check.

## Install

This pack is **not published to the public npm registry**. Customers receive a tarball or private registry credentials with their commercial license.

```bash
npm install @mcpshield/pack-atlassian   # from licensed registry
```

Then add it to `mcpshield.yaml`:

```yaml
packs:
  - "@mcpshield/pack-atlassian"
```

Restart `mcpshield start`. The pack's strategy, enricher, exempt domains, and templates are registered into the gateway's runtime; templates become available via the admin UI.

## License

Commercial — see [`LICENSE`](LICENSE) (`LICENSE-COMMERCIAL` from repo root). Contact egaile@gmail.com for licensing.
