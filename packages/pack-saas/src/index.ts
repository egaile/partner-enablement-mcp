import { definePack } from "@mcpshield/sdk";

/**
 * SaaS / SOC2 baseline pack.
 *
 * The reference industry pack. Ships with MCPShield core under MIT.
 * Conservative defaults: no industry-specific PII patterns beyond what
 * the gateway core already detects (email, phone, IP); SOC2 framework reference.
 *
 * Use this as the template for writing your own packs.
 */
export default definePack({
  id: "saas",
  name: "SaaS / Technology",
  description:
    "SOC2-aligned baseline for B2B SaaS, technology, and developer-tools companies. Conservative defaults: an audit-everything template plus a placeholder secrets template.",
  pii: [],
  policyTemplates: [
    {
      id: "saas_audit_everything",
      name: "Audit Everything",
      description:
        "Log every tool call. Ideal as a starter for SOC2 evidence collection.",
      category: "compliance",
      rules: [
        {
          name: "Log all tool calls",
          description: "Log every tool call for audit trail",
          priority: 1000,
          conditions: { tools: ["*"] },
          action: "log_only",
        },
      ],
    },
    {
      id: "saas_secrets_shield",
      name: "Secrets Shield",
      description:
        "Placeholder: sets redactSecrets on every tool call, which the gateway does not enforce yet. No secrets are blocked or redacted today.",
      category: "security",
      rules: [
        {
          name: "Redact secrets in I/O",
          description:
            "Placeholder: sets redactSecrets, which the gateway does not enforce yet",
          priority: 100,
          conditions: { tools: ["*"] },
          action: "allow",
          modifiers: { redactSecrets: true },
        },
      ],
    },
  ],
  compliance: [{ id: "soc2", name: "SOC 2" }],
  defaultClassification: "internal",
  onboardingCopy: {
    headline: "SaaS baseline: SOC2-aligned defaults",
    bullets: [
      "Log every tool call as audit evidence",
      "Secrets redaction placeholder (redactSecrets is not enforced yet)",
      "Conservative redaction labels for safe shareable transcripts",
    ],
  },
});
