import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import { getAlertsForTenant, acknowledgeAlert } from "../db/queries/alerts.js";
import { BulkAcknowledgeSchema } from "../schemas/index.js";
import type { AlertSeverity, AlertType } from "../schemas/index.js";
import type { GatewayState } from "./types.js";

export function createAlertsRouter(state: GatewayState): Router {
  const router = Router();

  router.get(
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
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
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
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/alerts/bulk-acknowledge",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = BulkAcknowledgeSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const { ids } = parsed.data;
        await Promise.all(
          ids.map((id) =>
            acknowledgeAlert(id, req.tenant!.tenantId, req.tenant!.userId)
          )
        );
        res.json({ success: true, acknowledged: ids.length });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
