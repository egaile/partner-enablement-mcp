import { Router } from "express";
import express from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import {
  getCurrentUsage,
  getUsageHistory,
  getServerCount,
} from "../db/queries/billing.js";
import { getPlan, PLANS } from "../billing/plans.js";
import { createCheckoutSession, createPortalSession, constructWebhookEvent } from "../billing/stripe.js";
import { StripeWebhookHandler } from "../billing/webhook-handler.js";
import { PlanCache } from "../billing/plan-cache.js";
import { CheckoutSchema, PortalSchema } from "../schemas/index.js";
import type { GatewayState } from "./types.js";

export function createBillingRouter(state: GatewayState): Router {
  const router = Router();
  const billingPlanCache = new PlanCache();
  const stripeWebhookHandler = new StripeWebhookHandler(billingPlanCache);

  router.get(
    "/api/billing/usage",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.tenant!.tenantId;
        const plan = getPlan(req.tenant!.plan ?? "starter");
        const usage = await getCurrentUsage(tenantId);
        const serverCount = await getServerCount(tenantId);

        res.json({
          plan: {
            id: plan.id,
            name: plan.name,
            maxServers: plan.maxServers,
            maxCallsPerMonth: plan.maxCallsPerMonth,
            priceMonthly: plan.priceMonthly,
          },
          usage: {
            callCount: usage.callCount,
            blockedCount: usage.blockedCount,
            serverCount,
          },
          limits: {
            callsUsedPercent:
              plan.maxCallsPerMonth === Infinity
                ? 0
                : Math.round(
                    (usage.callCount / plan.maxCallsPerMonth) * 100
                  ),
            serversUsedPercent:
              plan.maxServers === Infinity
                ? 0
                : Math.round((serverCount / plan.maxServers) * 100),
          },
        });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.get(
    "/api/billing/history",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const months = Number(req.query.months) || 6;
        const history = await getUsageHistory(req.tenant!.tenantId, months);
        res.json({ history });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.get("/api/billing/plans", (_req, res) => {
    const plans = Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      maxServers: p.maxServers,
      maxCallsPerMonth: p.maxCallsPerMonth,
      priceMonthly: p.priceMonthly,
      features: p.features,
    }));
    res.json({ plans });
  });

  router.post(
    "/api/billing/checkout",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = CheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const { planId, successUrl, cancelUrl } = parsed.data;

        // Validate redirect URLs to prevent open redirect
        const allowedRedirectHosts = [
          ...state.allowedOrigins.map((o) => { try { return new URL(o).host; } catch { return null; } }).filter(Boolean),
          "localhost:3001",
        ];
        const isAllowedUrl = (url: string): boolean => {
          try {
            const parsed = new URL(url);
            return allowedRedirectHosts.some((h) => parsed.host === h) || parsed.host.endsWith(".vercel.app");
          } catch { return false; }
        };
        if (!isAllowedUrl(successUrl) || !isAllowedUrl(cancelUrl)) {
          res.status(400).json({ error: "Redirect URLs must be from an allowed domain" });
          return;
        }

        const plan = PLANS[planId as keyof typeof PLANS];
        if (!plan || !plan.stripePriceId) {
          res.status(400).json({ error: "Invalid plan or plan has no Stripe price" });
          return;
        }

        const session = await createCheckoutSession(
          req.tenant!.tenantId,
          plan.stripePriceId,
          successUrl,
          cancelUrl
        );

        res.json(session);
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/billing/portal",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = PortalSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const { returnUrl } = parsed.data;

        // Validate redirect URL to prevent open redirect
        const isAllowedReturn = (() => {
          try {
            const parsed = new URL(returnUrl);
            const hosts = state.allowedOrigins.map((o) => { try { return new URL(o).host; } catch { return null; } }).filter(Boolean);
            return hosts.some((h) => parsed.host === h) || parsed.host === "localhost:3001" || parsed.host.endsWith(".vercel.app");
          } catch { return false; }
        })();
        if (!isAllowedReturn) {
          res.status(400).json({ error: "returnUrl must be from an allowed domain" });
          return;
        }

        const session = await createPortalSession(
          req.tenant!.tenantId,
          returnUrl
        );

        res.json(session);
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      try {
        const signature = req.headers["stripe-signature"] as string;
        if (!signature) {
          res.status(400).json({ error: "Missing stripe-signature header" });
          return;
        }

        const event = constructWebhookEvent(req.body, signature);
        await stripeWebhookHandler.handleEvent(event);
        res.json({ received: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error("[stripe] Webhook error:", msg);
        res.status(400).json({ error: msg });
      }
    }
  );

  return router;
}
