/**
 * Cloud ApprovalEngine — thin wrapper around gateway-core's engine,
 * wired to the SupabaseStorageBackend.
 *
 * Re-exports `ApprovalContext` and `ApprovalRequestRecord` (renamed from
 * the legacy `ApprovalRecord`) so existing routes keep compiling.
 */

import {
  ApprovalEngine as CoreApprovalEngine,
  type ApprovalContext,
} from "@mcpshield/gateway-core/approval";
import type { ApprovalRequestRecord } from "@mcpshield/gateway-core/storage";
import { SupabaseStorageBackend } from "../storage/supabase.js";

export type { ApprovalContext };
export type ApprovalRecord = ApprovalRequestRecord;

export class ApprovalEngine extends CoreApprovalEngine {
  constructor() {
    super({ approvals: new SupabaseStorageBackend().approvals });
  }
}
