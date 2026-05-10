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
  BaseAuditLogger,
  ConfigError,
  DriftDetector,
  GatewayProxyEngine,
  PolicyEngine,
  SqliteStorageBackend,
  getScanner,
  loadConfig,
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

  const auditLogger = new BaseAuditLogger({
    audit: storage.audit,
    batchSize: config.audit.batchSize,
    flushIntervalMs: config.audit.flushIntervalMs,
  });
  auditLogger.start();

  const policyEngine = new PolicyEngine({ policies: storage.policies });
  const driftDetector = new DriftDetector({ snapshots: storage.snapshots });

  const engine = new GatewayProxyEngine({
    storage,
    policyEngine,
    driftDetector,
    scanner: getScanner(),
    auditRecorder: auditLogger,
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

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[mcpshield] ${signal} received, shutting down...`);
    try {
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
