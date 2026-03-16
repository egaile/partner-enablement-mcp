import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { requireRole } from "../auth/role-guard.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import { getTeamMembers, inviteTeamMember, removeTeamMember, updateMemberRole } from "../db/queries/team.js";
import { InviteTeamMemberSchema, UpdateMemberRoleSchema } from "../schemas/index.js";
import type { GatewayState } from "./types.js";

export function createTeamRouter(state: GatewayState): Router {
  const router = Router();

  router.get(
    "/api/settings/team",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const members = await getTeamMembers(req.tenant!.tenantId);
        res.json({ members });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/settings/team/invite",
    requireAuth,
    requireRole(["owner", "admin"]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = InviteTeamMemberSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const { clerkUserId, role } = parsed.data;
        const member = await inviteTeamMember(req.tenant!.tenantId, clerkUserId, role);
        res.status(201).json({ member });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.delete(
    "/api/settings/team/:userId",
    requireAuth,
    requireRole(["owner"]),
    async (req: AuthenticatedRequest, res) => {
      try {
        await removeTeamMember(req.tenant!.tenantId, req.params.userId);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.put(
    "/api/settings/team/:userId/role",
    requireAuth,
    requireRole(["owner"]),
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = UpdateMemberRoleSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const { role } = parsed.data;
        const member = await updateMemberRole(req.tenant!.tenantId, req.params.userId, role);
        res.json({ member });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
