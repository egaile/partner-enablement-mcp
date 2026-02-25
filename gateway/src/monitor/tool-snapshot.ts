import { createHash } from "node:crypto";
import {
  getSnapshot,
  upsertSnapshot,
} from "../db/queries/snapshots.js";
import type { DriftResult } from "./types.js";

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export function hashToolDefinition(def: ToolDefinition): string {
  const canonical = JSON.stringify({
    name: def.name,
    description: def.description ?? "",
    inputSchema: def.inputSchema ?? {},
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function checkToolDrift(
  tenantId: string,
  serverId: string,
  tool: ToolDefinition
): Promise<DriftResult> {
  const currentHash = hashToolDefinition(tool);
  const snapshot = await getSnapshot(tenantId, serverId, tool.name);

  // No existing snapshot — this is a new tool, auto-approve
  if (!snapshot) {
    await upsertSnapshot(tenantId, serverId, tool.name, currentHash, {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    });
    return {
      drifted: false,
      toolName: tool.name,
      severity: null,
      changes: [],
      currentHash,
      approvedHash: currentHash,
    };
  }

  // Hash matches — no drift
  if (snapshot.definitionHash === currentHash) {
    return {
      drifted: false,
      toolName: tool.name,
      severity: null,
      changes: [],
      currentHash,
      approvedHash: snapshot.definitionHash,
    };
  }

  // Drift detected — classify severity
  const changes: string[] = [];
  const oldDef = snapshot.definition as {
    name?: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  };

  // Check description changes
  if ((oldDef.description ?? "") !== (tool.description ?? "")) {
    changes.push("description changed");
  }

  // Check schema changes
  const oldSchema = oldDef.inputSchema ?? {};
  const newSchema = tool.inputSchema ?? {};
  const oldProps = (oldSchema as Record<string, unknown>).properties as
    | Record<string, unknown>
    | undefined;
  const newProps = (newSchema as Record<string, unknown>).properties as
    | Record<string, unknown>
    | undefined;

  if (oldProps && newProps) {
    const oldKeys = new Set(Object.keys(oldProps));
    const newKeys = new Set(Object.keys(newProps));

    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        changes.push(`parameter added: ${key}`);
      }
    }
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        changes.push(`parameter removed: ${key}`);
      }
    }
  } else if (!oldProps && newProps) {
    changes.push("input schema added");
  } else if (oldProps && !newProps) {
    changes.push("input schema removed");
  }

  // Classify severity
  let severity: DriftResult["severity"] = "cosmetic";
  if (changes.some((c) => c.startsWith("parameter added"))) {
    severity = "critical"; // New params could be used for injection
  } else if (
    changes.some(
      (c) =>
        c.startsWith("parameter removed") ||
        c.includes("schema added") ||
        c.includes("schema removed")
    )
  ) {
    severity = "functional";
  }

  return {
    drifted: true,
    toolName: tool.name,
    severity,
    changes,
    currentHash,
    approvedHash: snapshot.definitionHash,
  };
}
