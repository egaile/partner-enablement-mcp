export interface ToolSnapshot {
  toolName: string;
  definitionHash: string;
  definition: {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  };
}

export interface DriftResult {
  drifted: boolean;
  toolName: string;
  severity: "critical" | "functional" | "cosmetic" | null;
  changes: string[];
  currentHash: string;
  approvedHash: string | null;
}
