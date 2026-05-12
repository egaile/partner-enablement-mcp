/**
 * @mcpshield/pack-atlassian — commercial Atlassian (Jira + Confluence) pack.
 *
 * Contributes:
 *   - AtlassianInjectionStrategy (20+ patterns targeting prompt injection
 *     payloads embedded in Jira issues + Confluence pages).
 *   - Atlassian audit enricher (extracts project keys, issue keys, space
 *     keys, page IDs, and operation type from tool params).
 *   - Six policy templates: Read-Only Jira, Protected Projects, Approval
 *     for Writes, Confluence View-Only, Audit Everything, PII Shield.
 *   - Exfiltration exempt domains for *.atlassian.net / .com /
 *     atl-paas.net so legitimate Atlassian URLs in tool responses
 *     don't trip the URL-exfiltration check.
 *
 * Commercial license — see LICENSE. Pack contents are reserved; the open
 * pack model in @mcpshield/sdk lets you build your own equivalent under
 * MIT if you don't want to license this one.
 */

import { definePack } from "@mcpshield/sdk";
import { AtlassianInjectionStrategy } from "./scanner-strategy.js";
import { atlassianAuditEnricher } from "./audit-enricher.js";
import { ATLASSIAN_POLICY_TEMPLATES } from "./policy-templates.js";

export { AtlassianInjectionStrategy } from "./scanner-strategy.js";
export {
  enrichAtlassianMetadata,
  atlassianAuditEnricher,
  type AtlassianMetadata,
  type AtlassianOperationType,
} from "./audit-enricher.js";
export {
  ATLASSIAN_POLICY_TEMPLATES,
  getAtlassianTemplate,
  getAtlassianTemplates,
  type AtlassianPolicyTemplate,
} from "./policy-templates.js";

export default definePack({
  id: "atlassian",
  name: "Atlassian (Jira + Confluence)",
  description:
    "Commercial Atlassian pack — Jira/Confluence-aware injection scanner, audit enrichment with project/space metadata, and six curated policy templates covering read-only access, write approvals, and PII redaction.",
  pii: [],
  scannerStrategies: [new AtlassianInjectionStrategy()],
  auditEnrichers: [atlassianAuditEnricher],
  exfiltrationExemptDomains: [
    /\.atlassian\.net$/i,
    /\.atlassian\.com$/i,
    /\.atl-paas\.net$/i,
  ],
  policyTemplates: ATLASSIAN_POLICY_TEMPLATES,
  compliance: [],
  defaultClassification: "confidential",
  onboardingCopy: {
    headline: "Atlassian baseline — Jira + Confluence security",
    bullets: [
      "Detect prompt-injection payloads embedded in Jira issues + Confluence pages",
      "Enrich audit logs with project keys, issue keys, and operation type",
      "Six one-click policy templates: read-only, write approval, PII shield, audit",
      "Atlassian URLs in tool responses are exempt from URL-exfiltration flagging",
    ],
  },
});
