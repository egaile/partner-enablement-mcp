import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import {
  getSnapshotsForServer,
  approveSnapshot,
  approveSnapshotWithNewHash,
} from "../db/queries/snapshots.js";
import type { GatewayState } from "./types.js";

export function createSnapshotsRouter(state: GatewayState): Router {
  const router = Router();

  router.get(
    "/api/servers/:serverId/snapshots",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const snapshots = await getSnapshotsForServer(
          req.tenant!.tenantId,
          req.params.serverId
        );
        res.json({ snapshots });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  router.post(
    "/api/servers/:serverId/snapshots/:snapshotId/approve",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { newHash, newDefinition } = req.body ?? {};
        if (newHash && newDefinition) {
          await approveSnapshotWithNewHash(
            req.params.snapshotId,
            req.tenant!.tenantId,
            newHash,
            newDefinition
          );
        } else {
          await approveSnapshot(
            req.params.snapshotId,
            req.tenant!.tenantId
          );
        }
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
