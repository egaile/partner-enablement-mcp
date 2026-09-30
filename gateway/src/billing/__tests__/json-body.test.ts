import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { jsonBodyExceptStripeWebhook } from "../json-body.js";

let http: HttpServer | undefined;
afterEach(async () => {
  await new Promise<void>((r) => (http ? http.close(() => r()) : r()));
  http = undefined;
});

// Mirrors gateway/src/index.ts + routes/billing.ts: a global parser, then the
// webhook route with its own express.raw().
async function start(): Promise<{ base: string; bodies: unknown[] }> {
  const bodies: unknown[] = [];
  const app = express();
  app.use(jsonBodyExceptStripeWebhook());
  app.post("/api/billing/webhook", express.raw({ type: "application/json" }), (req, res) => {
    bodies.push(req.body);
    res.end();
  });
  app.post("/api/policies", (req, res) => {
    bodies.push(req.body);
    res.end();
  });
  http = app.listen(0, "127.0.0.1");
  await new Promise((r) => http!.once("listening", r));
  return { base: `http://127.0.0.1:${(http!.address() as AddressInfo).port}`, bodies };
}

async function post(url: string) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "evt_1" }),
  });
}

describe("jsonBodyExceptStripeWebhook", () => {
  it.each(["/api/billing/webhook", "/api/billing/webhook/", "/API/Billing/Webhook"])(
    "leaves the raw body for Stripe at %s",
    async (path) => {
      const { base, bodies } = await start();
      await post(base + path);
      expect(Buffer.isBuffer(bodies[0])).toBe(true);
      expect((bodies[0] as Buffer).toString()).toBe('{"id":"evt_1"}');
    }
  );

  it("parses JSON for every other route", async () => {
    const { base, bodies } = await start();
    await post(`${base}/api/policies`);
    expect(bodies[0]).toEqual({ id: "evt_1" });
  });
});
