/**
 * Data classification tiers used by industry packs and audit logging.
 * Higher tiers (restricted) imply stricter handling.
 */
export type DataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";
