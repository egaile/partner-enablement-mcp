/**
 * `mcpshield webhooks add | list | remove` — manage webhook subscribers
 * for the local SQLite backend.
 *
 * Webhook events are the canonical alert names:
 *   injection_detected, policy_violation, tool_drift,
 *   rate_limit_exceeded, auth_failure, server_error
 */

import { randomBytes } from "node:crypto";
import {
  SqliteStorageBackend,
  loadConfig,
  ALERT_EVENTS,
} from "@mcpshield/gateway-core";
import { resolveConfigPath, resolveDbPath } from "../lib/paths.js";

const KNOWN_EVENTS = Object.values(ALERT_EVENTS);

export interface WebhookAddOptions {
  configPath?: string;
  url?: string;
  events?: string;
  secret?: string;
}

export async function runWebhookAdd(
  options: WebhookAddOptions = {}
): Promise<void> {
  if (!options.url) {
    console.error("Missing --url. Example:");
    console.error(
      `  mcpshield webhooks add --url https://hooks.slack.com/services/... --events injection_detected,server_error`
    );
    process.exit(1);
  }

  const events = (options.events
    ? options.events.split(",").map((e) => e.trim()).filter(Boolean)
    : []
  );

  if (events.length === 0) {
    console.error(
      `Missing --events. Pick one or more of: ${KNOWN_EVENTS.join(", ")}`
    );
    process.exit(1);
  }
  const unknown = events.filter((e) => !KNOWN_EVENTS.includes(e as never));
  if (unknown.length > 0) {
    console.error(`Unknown event(s): ${unknown.join(", ")}`);
    console.error(`Known events: ${KNOWN_EVENTS.join(", ")}`);
    process.exit(1);
  }

  const secret = options.secret ?? `whk_${randomBytes(24).toString("hex")}`;
  const configPath = resolveConfigPath(options.configPath);
  const config = await loadConfig({ path: configPath });
  const dbPath = resolveDbPath(configPath, config.audit.path);

  const storage = new SqliteStorageBackend({ path: dbPath });
  await storage.init();
  try {
    const tenant = await storage.tenants.getOrCreateDefault();
    const wh = await storage.webhooks.create({
      tenantId: tenant.id,
      url: options.url,
      secret,
      events,
    });
    console.log("");
    console.log(`Registered webhook ${wh.id}`);
    console.log(`  URL:    ${wh.url}`);
    console.log(`  Events: ${wh.events.join(", ")}`);
    if (!options.secret) {
      console.log("");
      console.log("Shared secret (shown only once — store it now):");
      console.log(`  ${secret}`);
      console.log("");
      console.log(
        "Verify deliveries with HMAC-SHA256 over the body using this secret."
      );
    }
  } finally {
    await storage.close();
  }
}

export interface WebhookListOptions {
  configPath?: string;
}

export async function runWebhookList(
  options: WebhookListOptions = {}
): Promise<void> {
  const configPath = resolveConfigPath(options.configPath);
  const config = await loadConfig({ path: configPath });
  const dbPath = resolveDbPath(configPath, config.audit.path);

  const storage = new SqliteStorageBackend({ path: dbPath });
  await storage.init();
  try {
    const tenant = await storage.tenants.getOrCreateDefault();
    const webhooks = await storage.webhooks.listForTenant(tenant.id);
    if (webhooks.length === 0) {
      console.log("No webhooks registered.");
      console.log("Add one with: mcpshield webhooks add --url <url> --events <events>");
      return;
    }
    for (const wh of webhooks) {
      console.log(`${wh.id}  ${wh.enabled ? "enabled " : "disabled"}  ${wh.url}`);
      console.log(`  events: ${wh.events.join(", ")}`);
      console.log(`  created: ${wh.createdAt}`);
    }
  } finally {
    await storage.close();
  }
}

export interface WebhookRemoveOptions {
  configPath?: string;
  id?: string;
}

export async function runWebhookRemove(
  options: WebhookRemoveOptions = {}
): Promise<void> {
  if (!options.id) {
    console.error("Missing webhook id. Run `mcpshield webhooks list` first.");
    process.exit(1);
  }
  const configPath = resolveConfigPath(options.configPath);
  const config = await loadConfig({ path: configPath });
  const dbPath = resolveDbPath(configPath, config.audit.path);

  const storage = new SqliteStorageBackend({ path: dbPath });
  await storage.init();
  try {
    const tenant = await storage.tenants.getOrCreateDefault();
    await storage.webhooks.delete(options.id, tenant.id);
    console.log(`Removed webhook ${options.id}`);
  } finally {
    await storage.close();
  }
}
