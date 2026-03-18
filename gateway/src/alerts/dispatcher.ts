import { createHmac } from "node:crypto";
import {
  getWebhooksByEvent,
  getWebhook,
  type WebhookRecord,
} from "../db/queries/webhooks.js";

/**
 * SSRF protection: validate that a webhook URL points to a public endpoint.
 * Blocks private IP ranges, localhost, IPv6 loopback, non-http(s) protocols,
 * and cloud metadata IPs.
 */
function isPublicUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  // Only allow http and https protocols
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block IPv6 loopback
  if (hostname === "[::1]" || hostname === "::1") {
    return false;
  }

  // Block localhost variants
  if (hostname === "localhost" || hostname === "localhost.localdomain") {
    return false;
  }

  // Check if hostname is an IP address
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b, c] = ipv4Match.map(Number);

    // 10.0.0.0/8
    if (a === 10) return false;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return false;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return false;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return false;
    // 169.254.0.0/16 (link-local, includes cloud metadata 169.254.169.254)
    if (a === 169 && b === 254) return false;
    // 0.0.0.0
    if (a === 0 && b === 0 && c === 0) return false;
  }

  return true;
}

export class AlertDispatcher {
  async dispatch(
    tenantId: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const webhooks = await getWebhooksByEvent(tenantId, event);

    for (const webhook of webhooks) {
      this.deliver(webhook, event, payload).catch((err) => {
        console.error(
          `[dispatcher] Failed to deliver webhook ${webhook.id} for event "${event}":`,
          err
        );
      });
    }
  }

  async sendTestEvent(webhookId: string, tenantId: string): Promise<void> {
    const webhook = await getWebhook(webhookId, tenantId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found for tenant ${tenantId}`);
    }

    const testPayload: Record<string, unknown> = {
      event: "test",
      timestamp: new Date().toISOString(),
      message: "This is a test event from the MCP Security Gateway.",
    };

    await this.deliver(webhook, "test", testPayload);
  }

  private async deliver(
    webhook: WebhookRecord,
    event: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    if (!isPublicUrl(webhook.url)) {
      throw new Error(
        `Webhook URL rejected: ${webhook.url} resolves to a private or disallowed address (SSRF protection)`
      );
    }

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
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(
        `Webhook delivery failed: ${response.status} ${response.statusText}`
      );
    }
  }
}
