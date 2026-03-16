import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import { ATLASSIAN_POLICY_TEMPLATES, getAtlassianTemplate } from "../policies/atlassian-templates.js";
import { createPolicy } from "../db/queries/policies.js";
import type { GatewayState } from "./types.js";

export function createTemplatesRouter(state: GatewayState): Router {
  const router = Router();

  router.get("/api/templates/atlassian", requireAuth, (_req, res) => {
    res.json({ templates: ATLASSIAN_POLICY_TEMPLATES });
  });

  router.post(
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
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
