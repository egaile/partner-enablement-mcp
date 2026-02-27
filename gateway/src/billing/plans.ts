/**
 * Plan definitions with limits and feature flags.
 */

export interface PlanDefinition {
  id: PlanId;
  name: string;
  maxServers: number;
  maxCallsPerMonth: number;
  /** 10% grace buffer — soft limit before hard cutoff */
  graceBuffer: number;
  features: {
    piiRedaction: boolean;
    hitlApprovals: boolean;
    webhooks: boolean;
    customPolicies: boolean;
    apiKeys: boolean;
    atlassianTemplates: boolean;
    prioritySupport: boolean;
  };
  priceMonthly: number | null; // null = custom pricing
  stripePriceId?: string;
}

export type PlanId = "starter" | "pro" | "business" | "enterprise";

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    maxServers: 1,
    maxCallsPerMonth: 1_000,
    graceBuffer: 0.1,
    features: {
      piiRedaction: false,
      hitlApprovals: false,
      webhooks: false,
      customPolicies: false,
      apiKeys: true,
      atlassianTemplates: true,
      prioritySupport: false,
    },
    priceMonthly: 0,
    stripePriceId: undefined,
  },
  pro: {
    id: "pro",
    name: "Pro",
    maxServers: 5,
    maxCallsPerMonth: 50_000,
    graceBuffer: 0.1,
    features: {
      piiRedaction: true,
      hitlApprovals: true,
      webhooks: true,
      customPolicies: true,
      apiKeys: true,
      atlassianTemplates: true,
      prioritySupport: false,
    },
    priceMonthly: 99,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  business: {
    id: "business",
    name: "Business",
    maxServers: 25,
    maxCallsPerMonth: 500_000,
    graceBuffer: 0.1,
    features: {
      piiRedaction: true,
      hitlApprovals: true,
      webhooks: true,
      customPolicies: true,
      apiKeys: true,
      atlassianTemplates: true,
      prioritySupport: true,
    },
    priceMonthly: 299,
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    maxServers: Infinity,
    maxCallsPerMonth: Infinity,
    graceBuffer: 0.1,
    features: {
      piiRedaction: true,
      hitlApprovals: true,
      webhooks: true,
      customPolicies: true,
      apiKeys: true,
      atlassianTemplates: true,
      prioritySupport: true,
    },
    priceMonthly: null,
    stripePriceId: undefined,
  },
};

/**
 * Get plan definition by ID, defaults to starter.
 */
export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] ?? PLANS.starter;
}

/**
 * Check if usage is within soft limit (limit + grace buffer).
 */
export function isWithinSoftLimit(
  currentUsage: number,
  plan: PlanDefinition
): boolean {
  if (plan.maxCallsPerMonth === Infinity) return true;
  const softLimit = plan.maxCallsPerMonth * (1 + plan.graceBuffer);
  return currentUsage < softLimit;
}

/**
 * Check if usage is approaching the limit (above 80%).
 */
export function isApproachingLimit(
  currentUsage: number,
  plan: PlanDefinition
): boolean {
  if (plan.maxCallsPerMonth === Infinity) return false;
  return currentUsage >= plan.maxCallsPerMonth * 0.8;
}
