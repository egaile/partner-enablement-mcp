import { Router, type NextFunction, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import { VIEWER_ROLE } from "../auth/viewer-access.js";
import { requireRole } from "../auth/role-guard.js";
import { ApprovalEngine } from "../approval/engine.js";
import { getApiKeyCreator } from "../db/queries/api-keys.js";
import type { GatewayState } from "./types.js";

// The approval gate only means something if the caller it holds back can't
// decide its own request. MCP clients use API keys, so API keys never decide.
// Runs before requireRole so the caller gets this specific message.
function refuseApiKeys(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.tenant?.userId.startsWith("apikey:")) {
    res.status(403).json({
      error: "API keys can't approve or reject requests. Sign in to the dashboard.",
    });
    return;
  }
  next();
}

const NOT_PENDING_MESSAGE =
  "This request is no longer pending. It was already decided, or it expired.";

// Deciding updates only a pending (and, for approve, unexpired) row. When no
// row matches, Supabase's .single() fails with PGRST116.
function isNotPendingError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "PGRST116";
}

/** Approving a held tool call is an admin decision. */
export const APPROVER_ROLES = ["owner", "admin"];

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
        if (req.tenant!.userRole === VIEWER_ROLE) {
          // Pending requests carry raw tool arguments from the demo site.
          res.json({
            ...result,
            data: result.data.map((r) => ({ ...r, params: {} })),
          });
          return;
        }
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/approvals/:id/approve",
    requireAuth,
    refuseApiKeys,
    requireRole(APPROVER_ROLES),
    async (req: AuthenticatedRequest, res) => {
      try {
        const refusal = await checkDecidable(req);
        if (refusal) {
          res.status(refusal.status).json({ error: refusal.error });
          return;
        }
        const record = await approvalEngine.approve(
          req.params.id,
          req.tenant!.tenantId,
          req.tenant!.userId
        );
        res.json({ approval: record });
      } catch (error) {
        if (isNotPendingError(error)) {
          res.status(409).json({ error: NOT_PENDING_MESSAGE });
          return;
        }
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/approvals/:id/reject",
    requireAuth,
    refuseApiKeys,
    requireRole(APPROVER_ROLES),
    async (req: AuthenticatedRequest, res) => {
      try {
        const refusal = await checkDecidable(req);
        if (refusal) {
          res.status(refusal.status).json({ error: refusal.error });
          return;
        }
        const record = await approvalEngine.reject(
          req.params.id,
          req.tenant!.tenantId,
          req.tenant!.userId
        );
        res.json({ approval: record });
      } catch (error) {
        if (isNotPendingError(error)) {
          res.status(409).json({ error: NOT_PENDING_MESSAGE });
          return;
        }
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  // The request must exist in this tenant, and nobody decides a request they
  // made themselves.
  async function checkDecidable(
    req: AuthenticatedRequest
  ): Promise<{ status: number; error: string } | null> {
    const { userId, tenantId } = req.tenant!;
    const record = await approvalEngine.get(req.params.id, tenantId);
    if (!record) {
      return { status: 404, error: "Approval request not found." };
    }
    // MCP calls are made with API keys, so the requester is "apikey:<id>".
    // The person behind that key is whoever created it.
    const requester = record.userId.startsWith("apikey:")
      ? await getApiKeyCreator(record.userId.slice("apikey:".length), tenantId)
      : record.userId;
    if (requester === userId) {
      return { status: 403, error: "You can't decide an approval request you made." };
    }
    return null;
  }

  return router;
}
