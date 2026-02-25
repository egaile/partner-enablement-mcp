export interface ThreatIndicator {
  strategy: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  fieldPath: string;
  matchedContent?: string;
}

export interface ThreatScanResult {
  clean: boolean;
  indicators: ThreatIndicator[];
  highestSeverity: ThreatIndicator["severity"] | null;
  scanDurationMs: number;
}

export interface ScanStrategy {
  name: string;
  scan(input: string, fieldPath: string): ThreatIndicator[];
}
