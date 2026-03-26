import type Stripe from "stripe";
import {
  updateTenantPlan,
  getTenantByStripeCustomerId,
} from "../db/queries/billing.js";
import { PLANS, type PlanId } from "./plans.js";
import type { PlanCache } from "./plan-cache.js";

/**
 * Handle Stripe webhook events.
 * Routes payment events to update tenant plan and usage.
 */
export class StripeWebhookHandler {
  private planCache: PlanCache;

  constructor(planCache: PlanCache) {
    this.planCache = planCache;
  }

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutComplete(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;
      case "invoice.payment_failed":
        await this.handlePaymentFailed(
          event.data.object as Stripe.Invoice
        );
        break;
      default:
        console.log(`[stripe] Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutComplete(
    session: Stripe.Checkout.Session
  ): Promise<void> {
    const tenantId = session.metadata?.tenantId;
    if (!tenantId) {
      console.error("[stripe] Checkout session missing tenantId metadata");
      return;
    }

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    // Determine plan from the price ID
    const planId = this.resolvePlanFromSubscription(session);

    if (planId) {
      const plan = PLANS[planId];
      await updateTenantPlan(
        tenantId,
        planId,
        { maxServers: plan.maxServers, maxCallsPerMonth: plan.maxCallsPerMonth },
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id,
        subscriptionId
      );
      this.planCache.invalidate(tenantId);
      console.log(
        `[stripe] Tenant ${tenantId} upgraded to ${planId} plan`
      );
    }
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;

    if (!customerId) return;

    const tenant = await getTenantByStripeCustomerId(customerId);
    if (!tenant) {
      console.error(
        `[stripe] No tenant found for Stripe customer ${customerId}`
      );
      return;
    }

    const planId = this.resolvePlanFromPriceId(
      subscription.items.data[0]?.price?.id
    );

    if (planId) {
      const plan = PLANS[planId];
      await updateTenantPlan(
        tenant.id,
        planId,
        { maxServers: plan.maxServers, maxCallsPerMonth: plan.maxCallsPerMonth },
        customerId,
        subscription.id
      );
      this.planCache.invalidate(tenant.id);
      console.log(
        `[stripe] Tenant ${tenant.id} plan updated to ${planId}`
      );
    }
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;

    if (!customerId) return;

    const tenant = await getTenantByStripeCustomerId(customerId);
    if (!tenant) return;

    // Downgrade to starter
    const starter = PLANS.starter;
    await updateTenantPlan(
      tenant.id,
      "starter",
      {
        maxServers: starter.maxServers,
        maxCallsPerMonth: starter.maxCallsPerMonth,
      },
      customerId,
      undefined
    );
    this.planCache.invalidate(tenant.id);
    console.log(
      `[stripe] Tenant ${tenant.id} downgraded to starter (subscription canceled)`
    );
  }

  private async handlePaymentFailed(
    invoice: Stripe.Invoice
  ): Promise<void> {
    const customerId =
      typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;

    if (!customerId) return;

    const tenant = await getTenantByStripeCustomerId(customerId);
    if (!tenant) return;

    console.warn(
      `[stripe] Payment failed for tenant ${tenant.id} (customer ${customerId})`
    );
    // Future: send notification, apply grace period, etc.
  }

  /**
   * Resolve plan ID from Stripe Checkout Session metadata or line items.
   */
  private resolvePlanFromSubscription(
    session: Stripe.Checkout.Session
  ): PlanId | null {
    // Check metadata first
    if (session.metadata?.planId) {
      return session.metadata.planId as PlanId;
    }

    // Fallback: resolve from line items price ID
    const lineItems = (session as unknown as Record<string, unknown>).line_items as
      | { data?: Array<{ price?: { id?: string } }> }
      | undefined;
    const priceId = lineItems?.data?.[0]?.price?.id;
    if (priceId) {
      return this.resolvePlanFromPriceId(priceId);
    }

    return null;
  }

  /**
   * Resolve plan ID from a Stripe price ID.
   */
  private resolvePlanFromPriceId(priceId?: string): PlanId | null {
    if (!priceId) return null;

    for (const plan of Object.values(PLANS)) {
      if (plan.stripePriceId === priceId) {
        return plan.id;
      }
    }

    return null;
  }
}
