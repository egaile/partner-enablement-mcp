import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import type { GatewayState } from "./types.js";

export function createHealthRouter(state: GatewayState): Router {
  const router = Router();

  router.get(
    "/api/servers/:id/health",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const engine = state.engines.get(req.tenant!.tenantId);
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
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
