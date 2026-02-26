import {
  createApprovalRequest,
  getApprovalRequest,
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  type ApprovalRecord,
} from "../db/queries/approvals.js";

export interface ApprovalContext {
  correlationId: string;
  userId: string;
  serverName: string;
  toolName: string;
  params: Record<string, unknown>;
}

export class ApprovalEngine {
  async requestApproval(
    tenantId: string,
    context: ApprovalContext
  ): Promise<ApprovalRecord> {
    return createApprovalRequest({
      tenantId,
      correlationId: context.correlationId,
      userId: context.userId,
      serverName: context.serverName,
      toolName: context.toolName,
      params: context.params,
    });
  }

  async approve(
    id: string,
    tenantId: string,
    decidedBy: string
  ): Promise<ApprovalRecord> {
    return approveRequest(id, tenantId, decidedBy);
  }

  async reject(
    id: string,
    tenantId: string,
    decidedBy: string
  ): Promise<ApprovalRecord> {
    return rejectRequest(id, tenantId, decidedBy);
  }

  async checkStatus(
    id: string,
    tenantId: string
  ): Promise<ApprovalRecord["status"] | null> {
    const record = await getApprovalRequest(id, tenantId);
    if (!record) return null;

    // Check if the pending request has expired
    if (
      record.status === "pending" &&
      new Date(record.expiresAt) < new Date()
    ) {
      return "expired";
    }

    return record.status;
  }

  async getPending(
    tenantId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ data: ApprovalRecord[]; count: number }> {
    return getPendingApprovals(tenantId, options);
  }
}
