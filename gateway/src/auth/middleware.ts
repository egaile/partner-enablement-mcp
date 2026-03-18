import type { Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { verifyToken } from "./clerk.js";
import { getTenantForUser, getTenantById, type Tenant } from "../db/queries/tenants.js";
import { getApiKeyByHash, updateLastUsed } from "../db/queries/api-keys.js";
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
    role: "member",
  });

  if (error) {
    // If the user already exists (unique_violation), fall through to lookup
    if (error.code === "23505") {
      console.log(`[auth] User ${clerkUserId} already provisioned (duplicate key), looking up tenant`);
      return getTenantForUser(clerkUserId);
    }
    throw error;
  }

  console.log(`[auth] Auto-provisioned user ${clerkUserId} to default tenant`);
  return getTenantForUser(clerkUserId);
}

/**
 * Dev mode: when CLERK_SECRET_KEY is "dev", skip Clerk verification
 * and use the "dev_user" tenant mapping seeded in the database.
 */
function isDevMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.CLERK_SECRET_KEY === "dev";
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // --- API key auth path (mgw_ prefix) ---
  if (authHeader?.startsWith("Bearer mgw_")) {
    const apiKey = authHeader.slice(7);
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const keyRecord = await getApiKeyByHash(keyHash);

    if (!keyRecord) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    // Check expiry
    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      res.status(401).json({ error: "API key has expired" });
      return;
    }

    const tenant = await getTenantById(keyRecord.tenantId);
    if (!tenant) {
      res.status(403).json({ error: "Tenant not found for API key" });
      return;
    }

    // Update last used timestamp (fire-and-forget)
    updateLastUsed(keyRecord.id).catch(() => {});

    req.tenant = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userId: `apikey:${keyRecord.id}`,
      userRole: "member",
      plan: tenant.plan ?? "starter",
    };

    next();
    return;
  }

  // --- Clerk / dev mode auth path ---
  let userId: string;

  if (isDevMode()) {
    // Dev mode — accept any request, map to dev_user
    userId = "dev_user";
  } else {
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
