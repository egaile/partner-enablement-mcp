/**
 * Webhook dispatcher — HMAC-SHA256 signed JSON POSTs to subscriber URLs.
 *
 * Delivery is fire-and-forget: failures log but never throw back to the
 * caller. Built-in SSRF protection rejects loopback / private / cloud-
 * metadata IPs by default. Self-host dev loops can opt in to loopback
 * delivery via `{ allowLoopback: true }` — useful for piping into a local
 * webhook tester.
 *
 * Header on every delivery:
 *   X-Webhook-Signature: <hex hmac-sha256 of body using webhook.secret>
 */

import { createHmac } from "node:crypto";
import type { WebhookRecord } from "../storage/types.js";

export interface WebhooksPort {
  listByEvent(tenantId: string, event: string): Promise<WebhookRecord[]>;
  get(id: string, tenantId: string): Promise<WebhookRecord | null>;
}

export interface WebhookDispatcherOptions {
  webhooks: WebhooksPort;
  /**
   * If true, permit loopback / private IP destinations. Default false.
   * Only enable for local development against a webhook receiver.
   */
  allowLoopback?: boolean;
  /** Per-delivery timeout. Defaults to 10s. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class WebhookDispatcher {
  private readonly webhooks: WebhooksPort;
  private readonly allowLoopback: boolean;
  private readonly timeoutMs: number;

  constructor(options: WebhookDispatcherOptions) {
    this.webhooks = options.webhooks;
    this.allowLoopback = options.allowLoopback ?? false;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Deliver `payload` to every webhook subscribed to `event`.
   *
   * Returns when all deliveries have been *initiated* — the HTTP requests
   * themselves complete in the background. Caller is not expected to await
   * for delivery success.
   */
  async dispatch(
    tenantId: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const subscribers = await this.webhooks.listByEvent(tenantId, event);
    for (const webhook of subscribers) {
      this.deliver(webhook, event, payload).catch((err) => {
        console.error(
          `[webhook] Delivery failed for webhook ${webhook.id} (${event}):`,
          err instanceof Error ? err.message : err
        );
      });
    }
  }

  /**
   * Send a synthetic `test` event to a single webhook. Used by the admin
   * "Send test event" button. Errors propagate so the UI can surface them.
   */
  async sendTestEvent(webhookId: string, tenantId: string): Promise<void> {
    const webhook = await this.webhooks.get(webhookId, tenantId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found for tenant ${tenantId}`);
    }
    await this.deliver(webhook, "test", {
      message: "This is a test event from MCPShield.",
    });
  }

  private async deliver(
    webhook: WebhookRecord,
    event: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.isAllowedUrl(webhook.url)) {
      throw new Error(
        `Webhook URL rejected: ${webhook.url} resolves to a disallowed address (SSRF protection)`
      );
    }

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    const signature = createHmac("sha256", webhook.secret)
      .update(body)
      .digest("hex");

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `Webhook delivery returned ${response.status} ${response.statusText}`
      );
    }
  }

  private isAllowedUrl(urlString: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      return false;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    if (this.allowLoopback) {
      return true;
    }

    const hostname = parsed.hostname.toLowerCase();

    if (hostname === "[::1]" || hostname === "::1") return false;
    if (hostname === "localhost" || hostname === "localhost.localdomain") {
      return false;
    }

    const ipv4Match = hostname.match(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    );
    if (ipv4Match) {
      const [, a, b, c] = ipv4Match.map(Number);
      if (a === 10) return false; // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
      if (a === 192 && b === 168) return false; // 192.168.0.0/16
      if (a === 127) return false; // 127.0.0.0/8 (loopback)
      if (a === 169 && b === 254) return false; // 169.254.0.0/16 (link-local + cloud metadata)
      if (a === 0 && b === 0 && c === 0) return false;
    }

    return true;
  }
}
