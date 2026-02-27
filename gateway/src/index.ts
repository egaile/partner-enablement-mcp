import { randomUUID } from "node:crypto";
import express from "express";
import helmet from "helmet";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig } from "./config.js";
import { GatewayProxyEngine } from "./proxy/engine.js";
import { requireAuth } from "./auth/middleware.js";
import type { AuthenticatedRequest } from "./auth/types.js";
import {
  getServersForTenant,
  createServer,
  updateServer,
  deleteServer,
} from "./db/queries/servers.js";
import {
  getAllPoliciesForTenant,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from "./db/queries/policies.js";
import { getAuditLogs, getAuditMetrics } from "./db/queries/audit.js";
import {
  getAlertsForTenant,
  acknowledgeAlert,
} from "./db/queries/alerts.js";
import {
  getSnapshotsForServer,
  approveSnapshot,
  approveSnapshotWithNewHash,
} from "./db/queries/snapshots.js";
import { RegisterServerSchema, PolicyRuleSchema } from "./schemas/index.js";
import type { AlertSeverity, AlertType } from "./schemas/index.js";
import { ApprovalEngine } from "./approval/engine.js";
import {
  getWebhooksForTenant,
  createWebhook,
  updateWebhook,
  deleteWebhook,
} from "./db/queries/webhooks.js";
import { AlertDispatcher } from "./alerts/dispatcher.js";
import { generateApiKey } from "./auth/api-keys.js";
import { createApiKeyRecord, getApiKeysForTenant, deleteApiKey } from "./db/queries/api-keys.js";
import { getTeamMembers, inviteTeamMember, removeTeamMember, updateMemberRole } from "./db/queries/team.js";
import { requireRole } from "./auth/role-guard.js";
import { PolicyEngine } from "./policy/engine.js";
import { getScanner } from "./security/scanner.js";
import { ATLASSIAN_POLICY_TEMPLATES, getAtlassianTemplate } from "./policies/atlassian-templates.js";
import {
  getCurrentUsage,
  getUsageHistory,
  getServerCount,
} from "./db/queries/billing.js";
import { getPlan, PLANS } from "./billing/plans.js";
import { createCheckoutSession, createPortalSession, constructWebhookEvent } from "./billing/stripe.js";
import { StripeWebhookHandler } from "./billing/webhook-handler.js";
import { PlanCache } from "./billing/plan-cache.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = express();

  // Security headers
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS — configurable via ALLOWED_ORIGINS env var
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  // Always allow local dev
  if (!allowedOrigins.includes("http://localhost:3001")) {
    allowedOrigins.push("http://localhost:3001");
  }

  app.use((_req, res, next) => {
    const origin = _req.headers.origin;
    if (origin && allowedOrigins.some((allowed) => origin === allowed || origin.endsWith(".vercel.app"))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id, X-API-Key");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Request size limit
  app.use(express.json({ limit: "1mb" }));

  // Health check (unauthenticated)
  app.get("/health", (_req, res) => {
    res.json({ status: "healthy", service: "mcp-security-gateway" });
  });

  // =========================================================================
  // MCP Proxy Endpoint
  // =========================================================================

  const engines = new Map<string, GatewayProxyEngine>();
  const mcpTransports = new Map<string, StreamableHTTPServerTransport>();

  async function getOrCreateEngine(
    tenantId: string,
    tenantContext: AuthenticatedRequest["tenant"]
  ): Promise<GatewayProxyEngine> {
    let engine = engines.get(tenantId);

    if (!engine) {
      engine = new GatewayProxyEngine();
      engine.setTenantContext(tenantContext!);
      engine.getAuditLogger().start();
      engine.getUsageMeter().start();
      await engine.connectDownstreamServers(tenantId);
      engines.set(tenantId, engine);
    }

    return engine;
  }

  // Stale transport cleanup — evict transports with no activity for 30 minutes
  const TRANSPORT_TTL_MS = 30 * 60 * 1000;
  const transportLastActivity = new Map<string, number>();

  setInterval(() => {
    const now = Date.now();
    for (const [sid, lastActive] of transportLastActivity.entries()) {
      if (now - lastActive > TRANSPORT_TTL_MS) {
        const transport = mcpTransports.get(sid);
        if (transport) {
          transport.close?.();
          mcpTransports.delete(sid);
        }
        transportLastActivity.delete(sid);
      }
    }
  }, 60_000);

  app.all("/mcp", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const engine = await getOrCreateEngine(
        req.tenant!.tenantId,
        req.tenant
      );

      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && mcpTransports.has(sessionId)) {
        transportLastActivity.set(sessionId, Date.now());
        const transport = mcpTransports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (req.method === "POST") {
        const sessionServer = engine.createSessionServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            mcpTransports.delete(sid);
            transportLastActivity.delete(sid);
          }
        };

        await sessionServer.connect(transport);
        await transport.handleRequest(req, res, req.body);

        const sid = transport.sessionId;
        if (sid) {
          mcpTransports.set(sid, transport);
          transportLastActivity.set(sid, Date.now());
        }
      } else {
        res.status(400).json({ error: "Bad request: no valid session" });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("[gateway] MCP proxy error:", msg);
      if (!res.headersSent) {
        res.status(500).json({ error: msg });
      }
    }
  });

  // =========================================================================
  // REST API — Server Management
  // =========================================================================

  app.get(
    "/api/servers",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const servers = await getServersForTenant(req.tenant!.tenantId);
        res.json({ servers });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/servers",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Check server limit for plan
        const currentCount = await getServerCount(req.tenant!.tenantId);
        const plan = getPlan(req.tenant!.plan ?? "starter");
        if (currentCount >= plan.maxServers) {
          res.status(402).json({
            error: `Server limit reached (${plan.maxServers} on ${plan.name} plan). Please upgrade to add more servers.`,
            currentCount,
            limit: plan.maxServers,
            plan: plan.id,
          });
          return;
        }

        const parsed = RegisterServerSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const server = await createServer(req.tenant!.tenantId, parsed.data);
        res.status(201).json({ server });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.put(
    "/api/servers/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const server = await updateServer(
          req.params.id,
          req.tenant!.tenantId,
          req.body
        );
        res.json({ server });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.delete(
    "/api/servers/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await deleteServer(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Policy Management
  // =========================================================================

  app.get(
    "/api/policies",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const policies = await getAllPoliciesForTenant(req.tenant!.tenantId);
        res.json({ policies });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/policies",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = PolicyRuleSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const policy = await createPolicy(req.tenant!.tenantId, parsed.data);
        res.json({ policy });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.put(
    "/api/policies/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const policy = await updatePolicy(
          req.params.id,
          req.tenant!.tenantId,
          req.body
        );
        res.json({ policy });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.delete(
    "/api/policies/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await deletePolicy(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Audit Logs
  // =========================================================================

  app.get(
    "/api/audit",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await getAuditLogs(req.tenant!.tenantId, {
          limit: Number(req.query.limit) || 50,
          offset: Number(req.query.offset) || 0,
          serverId: req.query.serverId as string | undefined,
          toolName: req.query.toolName as string | undefined,
          startDate: req.query.startDate as string | undefined,
          endDate: req.query.endDate as string | undefined,
        });
        res.json(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/audit/metrics",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const since =
          (req.query.since as string) ||
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const metrics = await getAuditMetrics(req.tenant!.tenantId, since);
        res.json(metrics);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Alerts
  // =========================================================================

  app.get(
    "/api/alerts",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await getAlertsForTenant(req.tenant!.tenantId, {
          limit: Number(req.query.limit) || 50,
          offset: Number(req.query.offset) || 0,
          acknowledged:
            req.query.acknowledged === "true"
              ? true
              : req.query.acknowledged === "false"
                ? false
                : undefined,
          severity: req.query.severity as AlertSeverity | undefined,
          type: req.query.type as AlertType | undefined,
        });
        res.json(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/alerts/:id/acknowledge",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await acknowledgeAlert(
          req.params.id,
          req.tenant!.tenantId,
          req.tenant!.userId
        );
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/alerts/bulk-acknowledge",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { ids } = req.body as { ids: string[] };
        if (!Array.isArray(ids) || ids.length === 0) {
          res.status(400).json({ error: "ids array required" });
          return;
        }
        await Promise.all(
          ids.map((id) =>
            acknowledgeAlert(id, req.tenant!.tenantId, req.tenant!.userId)
          )
        );
        res.json({ success: true, acknowledged: ids.length });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Tool Snapshots
  // =========================================================================

  app.get(
    "/api/servers/:serverId/snapshots",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const snapshots = await getSnapshotsForServer(
          req.tenant!.tenantId,
          req.params.serverId
        );
        res.json({ snapshots });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/servers/:serverId/snapshots/:snapshotId/approve",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { newHash, newDefinition } = req.body ?? {};
        if (newHash && newDefinition) {
          await approveSnapshotWithNewHash(
            req.params.snapshotId,
            req.tenant!.tenantId,
            newHash,
            newDefinition
          );
        } else {
          await approveSnapshot(
            req.params.snapshotId,
            req.tenant!.tenantId
          );
        }
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Server Health
  // =========================================================================

  app.get(
    "/api/servers/:id/health",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const engine = engines.get(req.tenant!.tenantId);
        if (!engine) {
          res.json({ status: "unknown", message: "No active engine for tenant" });
          return;
        }
        const healthChecker = engine.getHealthChecker();
        if (!healthChecker) {
          res.json({ status: "unknown", message: "Health checker not initialized" });
          return;
        }
        const status = healthChecker.getStatus(req.params.id);
        res.json(status ?? { status: "unknown", message: "Server not tracked" });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Policy Simulator
  // =========================================================================

  const simulatorPolicyEngine = new PolicyEngine();

  app.post(
    "/api/policies/simulate",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { serverName, toolName, userId, params } = req.body;
        if (!serverName || !toolName) {
          res.status(400).json({ error: "serverName and toolName are required" });
          return;
        }

        const decision = await simulatorPolicyEngine.evaluate(
          req.tenant!.tenantId,
          { serverName, toolName, userId: userId || req.tenant!.userId }
        );

        const scanner = getScanner();
        const scanResult = params ? scanner.scan(params) : null;

        res.json({
          decision: decision.action,
          matchedRule: decision.ruleId
            ? { ruleId: decision.ruleId, ruleName: decision.ruleName, action: decision.action }
            : null,
          modifiers: decision.modifiers,
          scanResult: scanResult
            ? { clean: scanResult.clean, threatCount: scanResult.indicators.length, highestSeverity: scanResult.highestSeverity }
            : null,
          wouldBeBlocked: decision.action === "deny" || (scanResult ? scanner.shouldBlock(scanResult) : false),
          reason: decision.action === "deny"
            ? `Blocked by policy "${decision.ruleName}"`
            : scanResult && scanner.shouldBlock(scanResult)
              ? `Blocked by threat detection (${scanResult.highestSeverity})`
              : "Allowed",
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — API Keys
  // =========================================================================

  app.get(
    "/api/settings/api-keys",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const keys = await getApiKeysForTenant(req.tenant!.tenantId);
        res.json({ keys });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/settings/api-keys",
    requireAuth,
    requireRole(["owner", "admin"]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { name, expiresAt } = req.body;
        if (!name) {
          res.status(400).json({ error: "name is required" });
          return;
        }

        const { key, keyHash, keyPrefix } = generateApiKey();
        const record = await createApiKeyRecord(req.tenant!.tenantId, {
          name,
          keyHash,
          keyPrefix,
          createdBy: req.tenant!.userId,
          expiresAt: expiresAt || null,
        });
        // Return the raw key ONCE — it cannot be retrieved again
        res.status(201).json({ key, record });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.delete(
    "/api/settings/api-keys/:id",
    requireAuth,
    requireRole(["owner", "admin"]),
    async (req: AuthenticatedRequest, res) => {
      try {
        await deleteApiKey(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Team Management
  // =========================================================================

  app.get(
    "/api/settings/team",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const members = await getTeamMembers(req.tenant!.tenantId);
        res.json({ members });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/settings/team/invite",
    requireAuth,
    requireRole(["owner", "admin"]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { clerkUserId, role } = req.body;
        if (!clerkUserId || !role) {
          res.status(400).json({ error: "clerkUserId and role are required" });
          return;
        }
        const member = await inviteTeamMember(req.tenant!.tenantId, clerkUserId, role);
        res.status(201).json({ member });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.delete(
    "/api/settings/team/:userId",
    requireAuth,
    requireRole(["owner"]),
    async (req: AuthenticatedRequest, res) => {
      try {
        await removeTeamMember(req.tenant!.tenantId, req.params.userId);
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.put(
    "/api/settings/team/:userId/role",
    requireAuth,
    requireRole(["owner"]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { role } = req.body;
        if (!role) {
          res.status(400).json({ error: "role is required" });
          return;
        }
        const member = await updateMemberRole(req.tenant!.tenantId, req.params.userId, role);
        res.json({ member });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Approvals (HITL)
  // =========================================================================

  const approvalEngine = new ApprovalEngine();

  app.get(
    "/api/approvals",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await approvalEngine.getPending(req.tenant!.tenantId, {
          limit: Number(req.query.limit) || 50,
          offset: Number(req.query.offset) || 0,
        });
        res.json(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/approvals/:id/approve",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const record = await approvalEngine.approve(
          req.params.id,
          req.tenant!.tenantId,
          req.tenant!.userId
        );
        res.json({ approval: record });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/approvals/:id/reject",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const record = await approvalEngine.reject(
          req.params.id,
          req.tenant!.tenantId,
          req.tenant!.userId
        );
        res.json({ approval: record });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Webhooks
  // =========================================================================

  const dispatcher = new AlertDispatcher();

  app.get(
    "/api/webhooks",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const webhooks = await getWebhooksForTenant(req.tenant!.tenantId);
        res.json({ webhooks });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/webhooks",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { url, secret, events, enabled } = req.body;
        if (!url || !secret || !events) {
          res.status(400).json({ error: "url, secret, and events are required" });
          return;
        }
        const webhook = await createWebhook(req.tenant!.tenantId, {
          url,
          secret,
          events,
          enabled,
        });
        res.status(201).json({ webhook });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.put(
    "/api/webhooks/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const webhook = await updateWebhook(
          req.params.id,
          req.tenant!.tenantId,
          req.body
        );
        res.json({ webhook });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.delete(
    "/api/webhooks/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await deleteWebhook(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/webhooks/:id/test",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await dispatcher.sendTestEvent(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Atlassian Policy Templates
  // =========================================================================

  app.get("/api/templates/atlassian", requireAuth, (_req, res) => {
    res.json({ templates: ATLASSIAN_POLICY_TEMPLATES });
  });

  app.post(
    "/api/templates/atlassian/:templateId/apply",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const template = getAtlassianTemplate(req.params.templateId);
        if (!template) {
          res.status(404).json({ error: "Template not found" });
          return;
        }

        const created = [];
        for (const rule of template.rules) {
          const policy = await createPolicy(req.tenant!.tenantId, {
            name: `[${template.name}] ${rule.name}`,
            description: rule.description,
            priority: rule.priority,
            conditions: rule.conditions,
            action: rule.action,
            modifiers: rule.modifiers ?? null,
            enabled: true,
          });
          created.push(policy);
        }

        res.status(201).json({ template: template.id, policies: created });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // =========================================================================
  // REST API — Billing & Usage
  // =========================================================================

  const billingPlanCache = new PlanCache();

  app.get(
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
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.get(
    "/api/billing/history",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const months = Number(req.query.months) || 6;
        const history = await getUsageHistory(req.tenant!.tenantId, months);
        res.json({ history });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.get("/api/billing/plans", (_req, res) => {
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

  app.post(
    "/api/billing/checkout",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { planId, successUrl, cancelUrl } = req.body;
        if (!planId || !successUrl || !cancelUrl) {
          res
            .status(400)
            .json({ error: "planId, successUrl, and cancelUrl are required" });
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
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  app.post(
    "/api/billing/portal",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { returnUrl } = req.body;
        if (!returnUrl) {
          res.status(400).json({ error: "returnUrl is required" });
          return;
        }

        const session = await createPortalSession(
          req.tenant!.tenantId,
          returnUrl
        );

        res.json(session);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: msg });
      }
    }
  );

  // Stripe webhook — must be before express.json() for raw body access
  // Since express.json() is already applied globally, we handle raw body via a dedicated middleware
  const stripeWebhookHandler = new StripeWebhookHandler(billingPlanCache);

  app.post(
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

  // =========================================================================
  // Start server
  // =========================================================================

  const server = app.listen(config.port, () => {
    console.log(
      `MCP Security Gateway running on http://localhost:${config.port}`
    );
    console.log(`  MCP proxy: POST /mcp`);
    console.log(`  REST API:  /api/*`);
    console.log(`  Health:    GET /health`);
  });

  // Graceful shutdown
  async function shutdown(signal: string) {
    console.log(`\n[gateway] ${signal} received. Shutting down gracefully...`);

    server.close();

    // Flush audit logs and disconnect downstream servers
    for (const engine of engines.values()) {
      try {
        await engine.shutdown();
      } catch (err) {
        console.error("[gateway] Error during engine shutdown:", err);
      }
    }

    // Close MCP transports
    for (const transport of mcpTransports.values()) {
      try {
        transport.close?.();
      } catch {
        // ignore
      }
    }

    console.log("[gateway] Shutdown complete.");
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("Gateway startup error:", error);
  process.exit(1);
});
