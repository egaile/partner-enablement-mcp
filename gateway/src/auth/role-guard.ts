import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./types.js";

/**
 * Express middleware factory that checks if the authenticated user's role
 * is included in the allowed roles array. Returns 403 Forbidden if not.
 *
 * Must be used after `requireAuth` middleware so that `req.tenant` is populated.
 */
export function requireRole(roles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.tenant) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!roles.includes(req.tenant.userRole)) {
      res.status(403).json({
        error: "Insufficient permissions",
        required: roles,
        current: req.tenant.userRole,
      });
      return;
    }

    next();
  };
}
