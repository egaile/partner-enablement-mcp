import { createHmac } from "node:crypto";
import {
  getWebhooksByEvent,
  getWebhook,
  type WebhookRecord,
} from "../db/queries/webhooks.js";

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
