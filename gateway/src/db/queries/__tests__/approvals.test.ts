import { describe, expect, it, vi } from "vitest";

let result: { data: unknown; error: { code: string } | null } = { data: null, error: null };
const chain = {
  select: () => chain,
  eq: () => chain,
  single: async () => result,
};
vi.mock("../../client.js", () => ({
  getSupabaseClient: () => ({ from: () => chain }),
}));

const { getApprovalRequest } = await import("../approvals.js");

describe("getApprovalRequest", () => {
  it.each(["PGRST116", "22P02"])("treats %s as not found", async (code) => {
    result = { data: null, error: { code } };
    await expect(getApprovalRequest("not-a-uuid", "t1")).resolves.toBeNull();
  });

  it("rethrows other errors", async () => {
    result = { data: null, error: { code: "08006" } };
    await expect(getApprovalRequest("x", "t1")).rejects.toMatchObject({ code: "08006" });
  });
});
