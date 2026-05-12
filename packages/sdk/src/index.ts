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

/**
 * Threat indicator emitted by a scanner strategy. Mirrors gateway-core's
 * `ThreatIndicator` so packs don't need to import gateway-core directly.
 */
export interface ThreatIndicator {
  strategy: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  fieldPath: string;
  matchedContent?: string;
}

/**
 * A scanner strategy contributed by a pack. The gateway runs every
 * registered strategy against every string in tool params + responses.
 *
 * Implementations should be PURE — no I/O, no shared state across calls.
 * Throwing inside scan() will be caught and reported as a degraded
 * strategy; the gateway never propagates the error to the client.
 */
export interface ScanStrategy {
  /** Stable identifier shown in audit details. */
  name: string;
  scan(input: string, fieldPath: string): ThreatIndicator[];
}

/**
 * An audit enricher contributed by a pack. The gateway runs every
 * registered enricher whenever an audit entry is being recorded for a
 * tool call and stores the (non-empty) return value on the audit row
 * under `threatDetails[enricher.namespace]`.
 *
 * Use for industry-specific metadata: project keys, ticket numbers,
 * patient IDs (post-hash), etc.
 */
export interface AuditEnricher {
  /** Stable identifier — also used as the threatDetails sub-key. */
  namespace: string;
  /** Return any object; the gateway skips storage if every value is null/undefined. */
  enrich(
    toolName: string,
    params: Record<string, unknown>
  ): Record<string, unknown> | null;
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
  /**
   * Additional scanner strategies — appended to the gateway-core defaults
   * (pattern-match, unicode, structural, exfiltration). Use for
   * domain-specific injection patterns the core scanner doesn't catch.
   */
  scannerStrategies?: ScanStrategy[];
  /**
   * Audit enrichers run on every recorded entry. Use for industry-specific
   * metadata (e.g. extracting Jira project keys from tool params).
   */
  auditEnrichers?: AuditEnricher[];
  /**
   * Hostnames matching these patterns are exempt from URL-exfiltration
   * flagging. Use for the legitimate endpoints of the systems this pack
   * targets (e.g. *.atlassian.net for an Atlassian pack).
   */
  exfiltrationExemptDomains?: RegExp[];
}

/**
 * Type-checks a pack definition and returns it unchanged.
 * Use this in your pack's entry file so TypeScript catches mistakes early.
 */
export function definePack(pack: IndustryPack): IndustryPack {
  return pack;
}

export const SDK_VERSION = "0.1.0";
