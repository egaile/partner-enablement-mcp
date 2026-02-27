import Stripe from "stripe";
import {
  getStripeCustomerId,
  setStripeCustomerId,
} from "../db/queries/billing.js";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

/**
 * Get or create a Stripe customer for a tenant.
 */
async function ensureCustomer(
  tenantId: string,
  email?: string
): Promise<string> {
  const existing = await getStripeCustomerId(tenantId);
  if (existing) return existing;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    metadata: { tenantId },
    email: email ?? undefined,
  });

  await setStripeCustomerId(tenantId, customer.id);
  return customer.id;
}

/**
 * Create a Stripe Checkout session for plan upgrade.
 */
export async function createCheckoutSession(
  tenantId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  email?: string
): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe();
  const customerId = await ensureCustomer(tenantId, email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenantId },
  });

  return { sessionId: session.id, url: session.url! };
}

/**
 * Create a Stripe Customer Portal session for subscription management.
 */
export async function createPortalSession(
  tenantId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const stripe = getStripe();
  const customerId = await ensureCustomer(tenantId);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

/**
 * Construct a Stripe webhook event from the raw body and signature.
 */
export function constructWebhookEvent(
  rawBody: Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
}
