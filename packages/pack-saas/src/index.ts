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
    "SOC2-aligned baseline for B2B SaaS, technology, and developer-tools companies. Conservative defaults; pair with the secrets scanner for full coverage.",
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
        "Block tool calls that contain leaked API keys, tokens, or private keys in their arguments or responses.",
      category: "security",
      rules: [
        {
          name: "Redact secrets in I/O",
          description:
            "Scan and redact API keys, tokens, and private-key headers from all tool I/O",
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
    headline: "SaaS baseline — SOC2-aligned defaults",
    bullets: [
      "Log every tool call as audit evidence",
      "Block leaked API keys from tool inputs and responses",
      "Conservative redaction labels for safe shareable transcripts",
    ],
  },
});
