import type { Request } from "express";

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  userId: string;
  userRole: string;
}

export interface AuthenticatedRequest extends Request {
  tenant?: TenantContext;
}
