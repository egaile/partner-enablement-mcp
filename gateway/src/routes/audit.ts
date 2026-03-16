import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import { getAuditLogs, getAuditMetrics } from "../db/queries/audit.js";
import type { GatewayState } from "./types.js";

export function createAuditRouter(state: GatewayState): Router {
  const router = Router();

  router.get(
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
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.get(
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
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.get(
    "/api/demo/audit-trail",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const result = await getAuditLogs(req.tenant!.tenantId, {
          limit: Math.min(Number(req.query.limit) || 20, 50),
          offset: Number(req.query.offset) || 0,
          serverId: req.query.serverId as string | undefined,
          toolName: req.query.toolName as string | undefined,
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
