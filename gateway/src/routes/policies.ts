import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import {
  getAllPoliciesForTenant,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from "../db/queries/policies.js";
import { PolicyRuleSchema, UpdatePolicySchema } from "../schemas/index.js";
import type { GatewayState } from "./types.js";

export function createPoliciesRouter(state: GatewayState): Router {
  const router = Router();

  router.get(
    "/api/policies",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const policies = await getAllPoliciesForTenant(req.tenant!.tenantId);
        res.json({ policies });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
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
        state.engines.get(req.tenant!.tenantId)?.clearPolicyCache(req.tenant!.tenantId);
        res.json({ policy });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.put(
    "/api/policies/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = UpdatePolicySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const policy = await updatePolicy(
          req.params.id,
          req.tenant!.tenantId,
          parsed.data
        );
        state.engines.get(req.tenant!.tenantId)?.clearPolicyCache(req.tenant!.tenantId);
        res.json({ policy });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.delete(
    "/api/policies/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await deletePolicy(req.params.id, req.tenant!.tenantId);
        state.engines.get(req.tenant!.tenantId)?.clearPolicyCache(req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
