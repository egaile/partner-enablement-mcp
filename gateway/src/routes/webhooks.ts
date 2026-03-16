import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import {
  getWebhooksForTenant,
  createWebhook,
  updateWebhook,
  deleteWebhook,
} from "../db/queries/webhooks.js";
import { AlertDispatcher } from "../alerts/dispatcher.js";
import { CreateWebhookSchema, UpdateWebhookSchema } from "../schemas/index.js";
import type { GatewayState } from "./types.js";

export function createWebhooksRouter(state: GatewayState): Router {
  const router = Router();
  const dispatcher = new AlertDispatcher();

  router.get(
    "/api/webhooks",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const webhooks = await getWebhooksForTenant(req.tenant!.tenantId);
        res.json({ webhooks });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/webhooks",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = CreateWebhookSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const webhook = await createWebhook(req.tenant!.tenantId, parsed.data);
        res.status(201).json({ webhook });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.put(
    "/api/webhooks/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = UpdateWebhookSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const webhook = await updateWebhook(
          req.params.id,
          req.tenant!.tenantId,
          parsed.data
        );
        res.json({ webhook });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.delete(
    "/api/webhooks/:id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await deleteWebhook(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/webhooks/:id/test",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        await dispatcher.sendTestEvent(req.params.id, req.tenant!.tenantId);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
