import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import { VIEWER_ROLE, demoUserIds } from "../auth/viewer-access.js";
import { getServersForTenant } from "../db/queries/servers.js";
import { getAuditLogs, getAuditMetrics } from "../db/queries/audit.js";
import { getAlertsForTenant } from "../db/queries/alerts.js";
import { getCurrentUsage, getServerCount } from "../db/queries/billing.js";
import { getPlan } from "../billing/plans.js";
import type { GatewayState } from "./types.js";

/**
 * Rec 9: Aggregated dashboard endpoint. Returns all dashboard data in a single call
 * instead of requiring 6+ separate API calls from the frontend.
 */
export function createDashboardRouter(state: GatewayState): Router {
  const router = Router();

  router.get("/api/me", requireAuth, (req: AuthenticatedRequest, res) => {
    const t = req.tenant!;
    res.json({
      tenantId: t.tenantId,
      tenantName: t.tenantName,
      userId: t.userId,
      role: t.userRole,
      plan: t.plan ?? "starter",
      readOnly: t.userRole === VIEWER_ROLE,
      // The shared public demo login, as opposed to a regular read-only user.
      demo: demoUserIds().has(t.userId),
    });
  });

  router.get(
    "/api/dashboard/overview",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.tenant!.tenantId;
        const since = (req.query.since as string) ||
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Fetch all dashboard data in parallel
        const [servers, auditResult, metrics, alerts, usage, serverCount] = await Promise.all([
          getServersForTenant(tenantId),
          getAuditLogs(tenantId, { limit: 20, offset: 0 }),
          getAuditMetrics(tenantId, since),
          getAlertsForTenant(tenantId, { limit: 20, offset: 0, acknowledged: false }),
          getCurrentUsage(tenantId),
          getServerCount(tenantId),
        ]);

        // Per-server health status
        const engine = state.engines.get(tenantId);
        const healthChecker = engine?.getHealthChecker();
        const serverHealth: Record<string, unknown> = {};
        if (healthChecker) {
          for (const server of servers) {
            serverHealth[server.id] = healthChecker.getStatus(server.id) ?? { status: "unknown" };
          }
        }

        const plan = getPlan(req.tenant!.plan ?? "starter");

        res.json({
          servers: servers.map(s => ({ id: s.id, name: s.name, transport: s.transport, enabled: s.enabled })),
          serverHealth,
          recentAudit: auditResult,
          metrics,
          alerts,
          billing: {
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
              callsUsedPercent: plan.maxCallsPerMonth === Infinity
                ? 0
                : Math.round((usage.callCount / plan.maxCallsPerMonth) * 100),
              serversUsedPercent: plan.maxServers === Infinity
                ? 0
                : Math.round((serverCount / plan.maxServers) * 100),
            },
          },
        });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
