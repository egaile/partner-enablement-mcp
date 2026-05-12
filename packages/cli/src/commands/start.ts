/**
 * `mcpshield start` — boot the self-hosted gateway.
 *
 * Pipeline:
 *   1. Load `mcpshield.yaml`
 *   2. Open SQLite storage at the configured path
 *   3. Upsert servers + policies from YAML
 *   4. Construct PolicyEngine + DriftDetector + BaseAuditLogger
 *   5. Construct GatewayProxyEngine (no cloud ports — self-host defaults)
 *   6. Connect downstream MCP servers
 *   7. Bootstrap Express + Streamable HTTP MCP transport
 *   8. Wait for SIGTERM / SIGINT; shut down cleanly
 */

import {
  ApiKeyAuthProvider,
  ApprovalEngine,
  BaseAuditLogger,
  ConfigError,
  DriftDetector,
  GatewayProxyEngine,
  PolicyEngine,
  SqliteStorageBackend,
  WebhookAlertSink,
  WebhookDispatcher,
  getScanner,
  loadConfig,
  loadPacks,
  watchConfig,
} from "@mcpshield/gateway-core";
import { applyConfig } from "../lib/apply-config.js";
import { resolveConfigPath, resolveDbPath } from "../lib/paths.js";
import { startHttpServer } from "../lib/http-server.js";

export interface StartOptions {
  configPath?: string;
  /** Bind host override (otherwise from config). */
  host?: string;
  /** Bind port override (otherwise from config). */
  port?: number;
  /** Enable API-key auth on /mcp. Defaults to false (loopback only). */
  requireAuth?: boolean;
  /** Disable filesystem watching of mcpshield.yaml. */
  noWatch?: boolean;
}

export async function runStart(options: StartOptions = {}): Promise<void> {
  const configPath = resolveConfigPath(options.configPath);
  console.log(`[mcpshield] Loading config from ${configPath}`);

  let config;
  try {
    config = await loadConfig({ path: configPath });
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[mcpshield] ${err.message}`);
    } else {
      console.error("[mcpshield] Failed to load config:", err);
    }
    process.exit(1);
  }

  const dbPath = resolveDbPath(configPath, config.audit.path);
  console.log(`[mcpshield] SQLite db: ${dbPath}`);

  const storage = new SqliteStorageBackend({ path: dbPath });
  await storage.init();

  const apply = await applyConfig(config, storage);
  console.log(
    `[mcpshield] Applied ${apply.serversApplied} server(s), ${apply.policiesApplied} policy rule(s)`
  );

  if (config.packs.length > 0) {
    const packResult = await loadPacks(config.packs);
    for (const ok of packResult.loaded) {
      console.log(
        `[mcpshield] Loaded pack ${ok.source} (${ok.pack.pii.length} PII patterns, ${ok.pack.policyTemplates.length} templates)`
      );
    }
    for (const fail of packResult.failed) {
      console.error(
        `[mcpshield] Failed to load pack ${fail.source}: ${fail.reason}`
      );
    }
  }

  const auditLogger = new BaseAuditLogger({
    audit: storage.audit,
    batchSize: config.audit.batchSize,
    flushIntervalMs: config.audit.flushIntervalMs,
  });
  auditLogger.start();

  const policyEngine = new PolicyEngine({ policies: storage.policies });
  const driftDetector = new DriftDetector({ snapshots: storage.snapshots });
  const approvalEngine = new ApprovalEngine({ approvals: storage.approvals });

  const webhookDispatcher = new WebhookDispatcher({
    webhooks: storage.webhooks,
  });
  const alertSink = new WebhookAlertSink(webhookDispatcher);

  const engine = new GatewayProxyEngine({
    storage,
    policyEngine,
    driftDetector,
    scanner: getScanner(),
    auditRecorder: auditLogger,
    alertSink,
    approvalEngine,
  });

  engine.setTenantContext({
    tenantId: apply.tenantId,
    tenantName: "default",
    userId: "self-hosted",
    userRole: "owner",
  });

  await engine.connectDownstreamServers(apply.tenantId);

  const host = options.host ?? config.server.host;
  const port = options.port ?? config.server.port;

  const authProvider = options.requireAuth
    ? new ApiKeyAuthProvider({ storage })
    : undefined;

  if (!authProvider && host !== "127.0.0.1" && host !== "localhost") {
    console.warn(
      `[mcpshield] WARNING: host=${host} but auth is disabled. /mcp will accept unauthenticated requests. Pass --auth or bind to 127.0.0.1.`
    );
  }

  const running = await startHttpServer({
    engine,
    authProvider,
    host,
    port,
    allowedOrigins: config.server.allowedOrigins,
  });

  // Hot-reload: watch the config file for changes. On valid reload, apply
  // servers + policies and clear the policy cache so new rules take effect
  // immediately. Server reconnects and pack changes still require a
  // restart — those are noted in the reload log line.
  const watcher = options.noWatch
    ? null
    : watchConfig({ path: configPath }, (next, err) => {
        if (err) {
          console.error(`[mcpshield] Config reload failed: ${err.message}`);
          return;
        }
        if (!next) return;
        void (async () => {
          try {
            const result = await applyConfig(next, storage);
            engine.clearPolicyCache();
            console.log(
              `[mcpshield] Reloaded: ${result.serversApplied} server(s), ${result.policiesApplied} policy rule(s); policy cache cleared`
            );
            // Server connections + pack registrations only happen at boot.
            // Surface this so users aren't surprised when those edits
            // don't appear to take effect.
            if (next.servers.length > 0 || next.packs.length > 0) {
              console.log(
                "[mcpshield]   note: server connections and pack registrations are bound at boot; restart to pick up changes there"
              );
            }
          } catch (e) {
            console.error("[mcpshield] Reload apply failed:", e);
          }
        })();
      });
  if (watcher) {
    console.log(`[mcpshield] Watching ${configPath} for changes`);
  }

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[mcpshield] ${signal} received, shutting down...`);
    try {
      if (watcher) await watcher.stop();
      await running.close();
      await engine.shutdown();
      await auditLogger.flush();
      auditLogger.stop();
      await storage.close();
      console.log("[mcpshield] Bye.");
      process.exit(0);
    } catch (err) {
      console.error("[mcpshield] Shutdown error:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
