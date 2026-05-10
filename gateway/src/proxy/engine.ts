/**
 * GatewayProxyEngine (cloud wrapper).
 *
 * The proxy itself lives in `@mcpshield/gateway-core`. This class composes
 * the core engine with the cloud's audit logger, alert engine, billing,
 * and OAuth provider, and re-exposes the helpers the existing routes /
 * shutdown handlers depend on.
 *
 * Keep this layer thin — anything that isn't tenant-multiplexed or
 * cloud-billed should live in the core engine.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  GatewayProxyEngine as CoreEngine,
  chainAlertSinks,
  type ConnectionManager,
  type HealthChecker,
  type TenantContext,
} from "@mcpshield/gateway-core/proxy";
import {
  DriftDetector,
  PolicyEngine,
  type McpServerRecord,
} from "@mcpshield/gateway-core";
import {
  WebhookAlertSink,
  WebhookDispatcher,
} from "@mcpshield/gateway-core/webhooks";
import { AuditLogger } from "../audit/logger.js";
import { AlertEngine } from "../alerts/engine.js";
import { UsageMeter } from "../billing/usage-meter.js";
import { PlanCache } from "../billing/plan-cache.js";
import { getScanner } from "../security/scanner.js";
import { SupabaseStorageBackend } from "../storage/supabase.js";
import { CloudAlertSink } from "./cloud-alert-sink.js";
import { CloudBillingGuard } from "./cloud-billing-guard.js";
import { CloudOAuthProviderFactory } from "./cloud-oauth-factory.js";

/**
 * Per-tenant proxy engine. Owns shared resources (downstream connections,
 * policy cache, audit buffer, alert engine, billing cache) and creates
 * session-scoped MCP `Server` instances on demand.
 */
export class GatewayProxyEngine {
  private readonly core: CoreEngine;
  private readonly auditLogger: AuditLogger;
  private readonly alertEngine: AlertEngine;
  private readonly usageMeter: UsageMeter;
  private readonly planCache: PlanCache;
  private readonly policyEngine: PolicyEngine;
  private readonly storage: SupabaseStorageBackend;

  constructor() {
    this.storage = new SupabaseStorageBackend();
    this.alertEngine = new AlertEngine();
    this.auditLogger = new AuditLogger();
    this.usageMeter = new UsageMeter();
    this.planCache = new PlanCache();

    this.policyEngine = new PolicyEngine({
      policies: this.storage.policies,
    });

    const driftDetector = new DriftDetector({
      snapshots: this.storage.snapshots,
    });

    this.auditLogger.setUsageMeter(this.usageMeter);

    const webhookDispatcher = new WebhookDispatcher({
      webhooks: this.storage.webhooks,
    });
    const alertSink = chainAlertSinks(
      new CloudAlertSink(this.alertEngine),
      new WebhookAlertSink(webhookDispatcher)
    );

    this.core = new CoreEngine({
      storage: this.storage,
      policyEngine: this.policyEngine,
      driftDetector,
      scanner: getScanner(),
      auditRecorder: this.auditLogger,
      alertSink,
      billingGuard: new CloudBillingGuard(this.planCache),
      oauthFactory: new CloudOAuthProviderFactory(),
    });
  }

  setTenantContext(ctx: TenantContext): void {
    this.core.setTenantContext(ctx);
  }

  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  getUsageMeter(): UsageMeter {
    return this.usageMeter;
  }

  getPlanCache(): PlanCache {
    return this.planCache;
  }

  getHealthChecker(): HealthChecker | null {
    return this.core.getHealthChecker();
  }

  getConnectionManager(): ConnectionManager {
    return this.core.getConnectionManager();
  }

  clearPolicyCache(tenantId?: string): void {
    this.core.clearPolicyCache(tenantId);
  }

  createSessionServer(): Server {
    return this.core.createSessionServer();
  }

  async connectDownstreamServers(tenantId: string): Promise<void> {
    await this.core.connectDownstreamServers(tenantId);
  }

  async connectServer(server: McpServerRecord): Promise<void> {
    await this.core.connectServer(server);
  }

  async shutdown(): Promise<void> {
    await this.core.shutdown();
    await this.usageMeter.flush();
    this.usageMeter.stop();
    await this.auditLogger.flush();
    this.auditLogger.stop();
  }
}
