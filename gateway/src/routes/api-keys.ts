import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { requireRole } from "../auth/role-guard.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import { generateApiKey } from "../auth/api-keys.js";
import { createApiKeyRecord, getApiKeysForTenant, deleteApiKey } from "../db/queries/api-keys.js";
import { CreateApiKeySchema } from "../schemas/index.js";
import type { GatewayState } from "./types.js";

export function createApiKeysRouter(state: GatewayState): Router {
  const router = Router();

  router.get(
    "/api/settings/api-keys",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const keys = await getApiKeysForTenant(req.tenant!.tenantId);
        res.json({ keys });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/settings/api-keys",
    requireAuth,
    requireRole(["owner", "admin"]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = CreateApiKeySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const { name, expiresAt } = parsed.data;

        const { key, keyHash, keyPrefix } = generateApiKey();
        const record = await createApiKeyRecord(req.tenant!.tenantId, {
          name,
          keyHash,
          keyPrefix,
          createdBy: req.tenant!.userId,
          expiresAt: expiresAt ?? undefined,
        });
        res.status(201).json({ key, record });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.delete(
    "/api/settings/api-keys/:id",
    requireAuth,
    requireRole(["owner", "admin"]),
    async (req: AuthenticatedRequest, res) => {
      try {
        await deleteApiKey(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
