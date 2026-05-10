/**
 * @mcpshield/sdk — Industry Pack SDK
 *
 * A pack is a small npm module that contributes industry-specific PII patterns,
 * policy templates, and compliance metadata to a running MCPShield gateway.
 *
 * Example pack:
 *
 *   import { definePack } from "@mcpshield/sdk";
 *
 *   export default definePack({
 *     id: "healthcare",
 *     name: "Healthcare (HIPAA)",
 *     pii: [
 *       {
 *         type: "mrn",
 *         pattern: /\bMRN[:\s#-]*\d{4,12}\b/gi,
 *         redactionLabel: "[PHI:MRN]",
 *         classification: "restricted",
 *       },
 *     ],
 *     policyTemplates: [],
 *     compliance: [{ id: "hipaa", name: "HIPAA" }],
 *     defaultClassification: "confidential",
 *   });
 */

export type DataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";

export interface PiiPatternDef {
  /** Stable identifier for this pattern type, e.g. "mrn", "iban", "aws_access_key". */
  type: string;
  /** Regex matched against every string in tool params/responses. Must use the `g` flag. */
  pattern: RegExp;
  /** Optional secondary validator (e.g. Luhn check, mod-97). Returning false rejects the match. */
  validator?: (match: string) => boolean;
  /** Replacement label shown in redacted output. Defaults to "[REDACTED]". */
  redactionLabel?: string;
  /** Highest data classification this pattern represents. */
  classification: DataClassification;
}

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: "access" | "security" | "compliance";
  rules: Array<{
    name: string;
    description: string;
    priority: number;
    conditions: {
      servers?: string[];
      tools?: string[];
      users?: string[];
    };
    action: "allow" | "deny" | "require_approval" | "log_only";
    modifiers?: {
      redactPII?: boolean;
      redactSecrets?: boolean;
      maxCallsPerMinute?: number;
    };
  }>;
}

export interface CompliancePack {
  id: string;
  name: string;
  knowledgeRef?: string;
}

export interface IndustryPack {
  /** Stable identifier, e.g. "healthcare", "financial", "saas". */
  id: string;
  /** Human-readable name. */
  name: string;
  /** One-line description shown in dashboard onboarding. */
  description: string;
  /** PII patterns this pack contributes to the global registry. */
  pii: PiiPatternDef[];
  /** Policy templates this pack offers as one-click setups. */
  policyTemplates: PolicyTemplate[];
  /** Compliance frameworks this pack maps to. */
  compliance: CompliancePack[];
  /** Default data classification for tool responses if no PII is detected. */
  defaultClassification: DataClassification;
  /** Onboarding copy shown to admins enabling this pack. */
  onboardingCopy?: { headline: string; bullets: string[] };
}

/**
 * Type-checks a pack definition and returns it unchanged.
 * Use this in your pack's entry file so TypeScript catches mistakes early.
 */
export function definePack(pack: IndustryPack): IndustryPack {
  return pack;
}

export const SDK_VERSION = "0.1.0";
