/**
 * @mcpshield/pack-healthcare — HIPAA-aligned industry pack.
 *
 * Contributes:
 *   - PII patterns:
 *       npi              National Provider Identifier (10 digits, mod-10 Luhn)
 *       icd10            ICD-10-CM diagnosis codes (e.g. E11.65, J45.909)
 *       dea              DEA registration numbers (AB1234567, mod-checksum)
 *       medical_record   Override of the core MRN pattern with a [PHI:MRN] label
 *
 *   - Policy templates:
 *       phi_shield                Redact PII on all tool I/O; allow but mark
 *       hipaa_audit_everything    Log every tool call for compliance evidence
 *       hipaa_approval_for_writes Require HITL approval for write-shaped tools
 *
 *   - Compliance: HIPAA
 *
 * Load by adding to mcpshield.yaml:
 *   packs:
 *     - "@mcpshield/pack-healthcare"
 */

import { definePack } from "@mcpshield/sdk";

/**
 * Mod-10 Luhn-style checksum used by the NPI Check Digit algorithm.
 * Adds prefix `80840` per CMS spec before applying Luhn.
 */
function npiChecksum(npi: string): boolean {
  const digits = npi.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  const padded = "80840" + digits.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < padded.length; i++) {
    let d = Number(padded[padded.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[9]);
}

/**
 * DEA number format: two letters, a space optional, 7 digits.
 * Checksum: sum of digits 1,3,5 + 2*(sum of digits 2,4,6); last digit of
 * that result must equal the 7th DEA digit.
 */
function deaChecksum(dea: string): boolean {
  const cleaned = dea.replace(/\s|-/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{7}$/.test(cleaned)) return false;
  const digits = cleaned.slice(2).split("").map(Number);
  const sumOdd = digits[0] + digits[2] + digits[4];
  const sumEven = 2 * (digits[1] + digits[3] + digits[5]);
  const expected = (sumOdd + sumEven) % 10;
  return expected === digits[6];
}

export default definePack({
  id: "healthcare",
  name: "Healthcare (HIPAA)",
  description:
    "HIPAA-aligned baseline for healthcare-adjacent workloads. Detects NPI, ICD-10, DEA, and PHI-labeled MRNs; ships three drop-in policy templates covering audit, redaction, and clinical-write approvals.",
  pii: [
    {
      type: "npi",
      pattern: /\b\d{10}\b/g,
      validator: npiChecksum,
      redactionLabel: "[PHI:NPI]",
      classification: "restricted",
    },
    {
      type: "icd10",
      // ICD-10-CM: 1 letter, 2 digits, optional dot + up to 4 alphanumerics.
      // Exclude obvious false positives (must follow a delimiter / start).
      pattern: /(?<![A-Z0-9])[A-TV-Z]\d{2}(?:\.[A-Z0-9]{1,4})?(?![A-Z0-9])/g,
      redactionLabel: "[PHI:ICD-10]",
      classification: "restricted",
    },
    {
      type: "dea",
      pattern: /\b[A-Z]{2}\s?\d{7}\b/g,
      validator: deaChecksum,
      redactionLabel: "[PHI:DEA]",
      classification: "restricted",
    },
    {
      // Override the core MRN pattern with a HIPAA-flavored redaction label.
      type: "medical_record",
      pattern: /\bMRN[:\s#-]*\d{4,12}\b/gi,
      redactionLabel: "[PHI:MRN]",
      classification: "restricted",
    },
  ],
  policyTemplates: [
    {
      id: "hipaa_phi_shield",
      name: "PHI Shield",
      description:
        "Redact PHI (NPI, ICD-10, DEA, MRN, SSN, DOB, email, phone) in every tool response. Allow the call, but never leak raw PHI through transcripts.",
      category: "compliance",
      rules: [
        {
          name: "Redact PHI in I/O",
          description:
            "Scan and redact PHI from all tool inputs and responses",
          priority: 100,
          conditions: { tools: ["*"] },
          action: "allow",
          modifiers: { redactPII: true },
        },
      ],
    },
    {
      id: "hipaa_audit_everything",
      name: "HIPAA: Audit Everything",
      description:
        "Log every tool call as compliance evidence. Pair with off-site audit-log retention to meet §164.312(b) requirements.",
      category: "compliance",
      rules: [
        {
          name: "Log all tool calls (HIPAA evidence)",
          description: "Log every tool call for §164.312(b) audit controls",
          priority: 900,
          conditions: { tools: ["*"] },
          action: "log_only",
        },
      ],
    },
    {
      id: "hipaa_approval_for_writes",
      name: "HIPAA: Approval for clinical writes",
      description:
        "Block write-shaped tool calls (edit*, update*, delete*, transition*) until an admin approves. Forces a paper trail on PHI mutations.",
      category: "security",
      rules: [
        {
          name: "Approve clinical write operations",
          description:
            "Require human-in-the-loop approval for any tool whose name implies a write",
          priority: 50,
          conditions: {
            tools: [
              "*__edit*",
              "*__update*",
              "*__delete*",
              "*__transition*",
              "*__create*",
            ],
          },
          action: "require_approval",
        },
      ],
    },
  ],
  compliance: [
    {
      id: "hipaa",
      name: "HIPAA",
      knowledgeRef:
        "https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html",
    },
  ],
  defaultClassification: "confidential",
  onboardingCopy: {
    headline: "Healthcare baseline — HIPAA-aligned defaults",
    bullets: [
      "Detect NPI, ICD-10, DEA, and MRN in tool inputs and responses",
      "Redact PHI before it reaches AI transcripts",
      "Require admin approval on clinical write operations",
      "Log everything for §164.312(b) audit-control evidence",
    ],
  },
});
