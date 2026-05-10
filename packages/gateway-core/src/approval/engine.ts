/**
 * ApprovalEngine — manages human-in-the-loop approval requests for tool
 * calls flagged by a `require_approval` policy.
 *
 * Storage is injected via an `ApprovalsPort` (a `StorageBackend.approvals`
 * implementation in practice). Self-host gets SQLite; cloud gets Supabase.
 *
 * The engine itself only persists state — it does NOT block / unblock the
 * proxy hot path. The interceptor's `require_approval` integration is
 * deliberately separate so callers can choose synchronous-block,
 * fire-and-record, or some retry pattern based on their needs.
 */

import type {
  ApprovalListOptions,
  ApprovalRequestCreateInput,
  ApprovalRequestRecord,
  ApprovalStatus,
} from "../storage/types.js";

/**
 * Storage shape the engine needs. Satisfied by `StorageBackend.approvals`.
 */
export interface ApprovalsPort {
  create(input: ApprovalRequestCreateInput): Promise<ApprovalRequestRecord>;
  get(
    id: string,
    tenantId: string
  ): Promise<ApprovalRequestRecord | null>;
  getByCorrelation(
    correlationId: string,
    tenantId: string
  ): Promise<ApprovalRequestRecord | null>;
  listPending(
    tenantId: string,
    options?: ApprovalListOptions
  ): Promise<{ data: ApprovalRequestRecord[]; count: number }>;
  approve(
    id: string,
    tenantId: string,
    decidedBy: string
  ): Promise<ApprovalRequestRecord>;
  reject(
    id: string,
    tenantId: string,
    decidedBy: string
  ): Promise<ApprovalRequestRecord>;
}

export interface ApprovalContext {
  correlationId: string;
  userId: string;
  serverName: string;
  toolName: string;
  params: Record<string, unknown>;
}

export interface ApprovalEngineOptions {
  approvals: ApprovalsPort;
}

export class ApprovalEngine {
  private readonly approvals: ApprovalsPort;

  constructor(options: ApprovalEngineOptions) {
    this.approvals = options.approvals;
  }

  requestApproval(
    tenantId: string,
    context: ApprovalContext
  ): Promise<ApprovalRequestRecord> {
    return this.approvals.create({
      tenantId,
      correlationId: context.correlationId,
      userId: context.userId,
      serverName: context.serverName,
      toolName: context.toolName,
      params: context.params,
    });
  }

  /**
   * Look up a request by id. Returns null if not found or wrong tenant.
   * Used by the interceptor to verify a claimed approval id matches the
   * current call (tool / user / server).
   */
  get(
    id: string,
    tenantId: string
  ): Promise<ApprovalRequestRecord | null> {
    return this.approvals.get(id, tenantId);
  }

  approve(
    id: string,
    tenantId: string,
    decidedBy: string
  ): Promise<ApprovalRequestRecord> {
    return this.approvals.approve(id, tenantId, decidedBy);
  }

  reject(
    id: string,
    tenantId: string,
    decidedBy: string
  ): Promise<ApprovalRequestRecord> {
    return this.approvals.reject(id, tenantId, decidedBy);
  }

  /**
   * Returns the effective status, accounting for expiry on still-pending
   * requests. Returns null if no request exists.
   */
  async checkStatus(
    id: string,
    tenantId: string
  ): Promise<ApprovalStatus | null> {
    const record = await this.approvals.get(id, tenantId);
    if (!record) return null;
    if (
      record.status === "pending" &&
      new Date(record.expiresAt) < new Date()
    ) {
      return "expired";
    }
    return record.status;
  }

  getPending(
    tenantId: string,
    options?: ApprovalListOptions
  ): Promise<{ data: ApprovalRequestRecord[]; count: number }> {
    return this.approvals.listPending(tenantId, options);
  }
}
