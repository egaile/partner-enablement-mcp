/**
 * Cloud-flavored drift detection. Existing free-function API is preserved
 * for backwards compat with proxy/tool-interceptor.ts; under the hood it
 * delegates to gateway-core's DriftDetector + SupabaseStorageBackend.
 */

import {
  DriftDetector,
  hashToolDefinition as coreHash,
  type ToolDefinition as CoreToolDefinition,
} from "@mcpshield/gateway-core/monitor";
import type { DriftResult } from "./types.js";
import { SupabaseStorageBackend } from "../storage/supabase.js";

export type ToolDefinition = CoreToolDefinition;

export const hashToolDefinition = coreHash;

let _detector: DriftDetector | null = null;
function getDetector(): DriftDetector {
  if (!_detector) {
    const backend = new SupabaseStorageBackend();
    _detector = new DriftDetector({ snapshots: backend.snapshots });
  }
  return _detector;
}

export async function checkToolDrift(
  tenantId: string,
  serverId: string,
  tool: ToolDefinition
): Promise<DriftResult> {
  return getDetector().check(tenantId, serverId, tool);
}
