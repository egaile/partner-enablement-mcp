import type { Response, NextFunction } from "express";
import { verifyToken } from "./clerk.js";
import { getTenantForUser, type Tenant } from "../db/queries/tenants.js";
import { getSupabaseClient } from "../db/client.js";
import type { AuthenticatedRequest } from "./types.js";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

async function autoProvisionUser(
  clerkUserId: string
): Promise<{ tenant: Tenant; role: string } | null> {
  const db = getSupabaseClient();

  // Add user to default tenant
  const { error } = await db.from("tenant_users").insert({
    tenant_id: DEFAULT_TENANT_ID,
    clerk_user_id: clerkUserId,
    role: "owner",
  });

  if (error) throw error;

  console.log(`[auth] Auto-provisioned user ${clerkUserId} to default tenant`);
  return getTenantForUser(clerkUserId);
}

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

  let tenantResult = await getTenantForUser(userId);

  // Auto-provision: if no tenant mapping exists, assign to default tenant
  if (!tenantResult) {
    try {
      tenantResult = await autoProvisionUser(userId);
    } catch (err) {
      console.error("[auth] Auto-provision failed:", err);
    }
  }

  if (!tenantResult) {
    res.status(403).json({ error: "User is not associated with any tenant" });
    return;
  }

  req.tenant = {
    tenantId: tenantResult.tenant.id,
    tenantName: tenantResult.tenant.name,
    userId,
    userRole: tenantResult.role,
    plan: tenantResult.tenant.plan ?? "starter",
  };

  next();
}
