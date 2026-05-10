/**
 * Tool drift detection.
 *
 * `hashToolDefinition()` is a pure function. `DriftDetector` is a class that
 * holds a reference to the snapshots storage port and exposes `check()` —
 * the hot-path API used by the proxy when the downstream MCP server returns
 * a `tools/list` response.
 *
 * Cloud and OSS both speak to the same port via their StorageBackend.snapshots
 * implementations.
 */

import { createHash } from "node:crypto";
import type {
  SnapshotUpsertInput,
  ToolSnapshotRecord,
} from "../storage/types.js";
import type { DriftResult } from "./types.js";

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface SnapshotsPort {
  get(
    tenantId: string,
    serverId: string,
    toolName: string
  ): Promise<ToolSnapshotRecord | null>;
  upsert(input: SnapshotUpsertInput): Promise<ToolSnapshotRecord>;
}

export function hashToolDefinition(def: ToolDefinition): string {
  const canonical = JSON.stringify({
    name: def.name,
    description: def.description ?? "",
    inputSchema: def.inputSchema ?? {},
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export interface DriftDetectorOptions {
  snapshots: SnapshotsPort;
}

export class DriftDetector {
  private readonly snapshots: SnapshotsPort;

  constructor(options: DriftDetectorOptions) {
    this.snapshots = options.snapshots;
  }

  async check(
    tenantId: string,
    serverId: string,
    tool: ToolDefinition
  ): Promise<DriftResult> {
    const currentHash = hashToolDefinition(tool);
    const snapshot = await this.snapshots.get(tenantId, serverId, tool.name);

    // No existing snapshot — auto-approve as the first observation.
    if (!snapshot) {
      await this.snapshots.upsert({
        tenantId,
        serverId,
        toolName: tool.name,
        definitionHash: currentHash,
        definition: {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
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

    const changes: string[] = [];
    const oldDef = snapshot.definition as {
      name?: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
    };

    if ((oldDef.description ?? "") !== (tool.description ?? "")) {
      changes.push("description changed");
    }

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
        if (!oldKeys.has(key)) changes.push(`parameter added: ${key}`);
      }
      for (const key of oldKeys) {
        if (!newKeys.has(key)) changes.push(`parameter removed: ${key}`);
      }
    } else if (!oldProps && newProps) {
      changes.push("input schema added");
    } else if (oldProps && !newProps) {
      changes.push("input schema removed");
    }

    let severity: DriftResult["severity"] = "cosmetic";
    if (changes.some((c) => c.startsWith("parameter added"))) {
      severity = "critical";
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

  /**
   * Mark the current tool definition as the approved snapshot.
   *
   * Used by the interceptor to auto-approve cosmetic drift (description-only
   * changes) and by the admin UI to approve a flagged drift after review.
   */
  async approve(
    tenantId: string,
    serverId: string,
    tool: ToolDefinition,
    hash?: string
  ): Promise<void> {
    await this.snapshots.upsert({
      tenantId,
      serverId,
      toolName: tool.name,
      definitionHash: hash ?? hashToolDefinition(tool),
      definition: {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
    });
  }
}
