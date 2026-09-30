import express, { type RequestHandler } from "express";
import { normalizePath } from "../lib/path.js";

export const STRIPE_WEBHOOK_PATH = "/api/billing/webhook";

/**
 * Global JSON body parser that leaves the Stripe webhook alone. Stripe signs
 * the raw body, so that route parses its own payload with express.raw();
 * letting express.json() consume it first breaks every signature check.
 */
export function jsonBodyExceptStripeWebhook(limit = "1mb"): RequestHandler {
  const jsonParser = express.json({ limit });
  return (req, res, next) => {
    if (normalizePath(req.path) === STRIPE_WEBHOOK_PATH) return next();
    jsonParser(req, res, next);
  };
}
