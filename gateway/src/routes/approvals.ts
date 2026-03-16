import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import { ApprovalEngine } from "../approval/engine.js";
import type { GatewayState } from "./types.js";

export function createApprovalsRouter(state: GatewayState): Router {
  const router = Router();
  const approvalEngine = new ApprovalEngine();

  router.get(
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
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
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
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
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
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
