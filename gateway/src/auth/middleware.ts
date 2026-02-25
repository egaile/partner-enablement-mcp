import type { Response, NextFunction } from "express";
import { verifyToken } from "./clerk.js";
import { getTenantForUser } from "../db/queries/tenants.js";
import type { AuthenticatedRequest } from "./types.js";

/**
 * Dev mode: when CLERK_SECRET_KEY is "dev", skip Clerk verification
 * and use the "dev_user" tenant mapping seeded in the database.
 */
function isDevMode(): boolean {
  return process.env.CLERK_SECRET_KEY === "dev";
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  let userId: string;

  if (isDevMode()) {
    // Dev mode — accept any request, map to dev_user
    userId = "dev_user";
  } else {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const token = authHeader.slice(7);
    const result = await verifyToken(token);
    if (!result) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    userId = result.userId;
  }

  const tenantResult = await getTenantForUser(userId);
  if (!tenantResult) {
    res.status(403).json({ error: "User is not associated with any tenant" });
    return;
  }

  req.tenant = {
    tenantId: tenantResult.tenant.id,
    tenantName: tenantResult.tenant.name,
    userId,
    userRole: tenantResult.role,
  };

  next();
}
