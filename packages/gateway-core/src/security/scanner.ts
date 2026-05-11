import type { ScanStrategy, ThreatIndicator, ThreatScanResult } from "./types.js";
import { PatternMatchStrategy } from "./strategies/pattern-match.js";
import { UnicodeAnalysisStrategy } from "./strategies/unicode-analysis.js";
import { StructuralStrategy } from "./strategies/structural.js";
import { ExfiltrationStrategy } from "./strategies/exfiltration.js";

const SEVERITY_ORDER: ThreatIndicator["severity"][] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

/**
 * Default strategies bundled with gateway-core. Generic, platform-agnostic.
 * Cloud impls (or callers) layer in domain-specific strategies (e.g.
 * AtlassianInjectionStrategy) by passing them to the constructor.
 */
export function defaultStrategies(): ScanStrategy[] {
  return [
    new PatternMatchStrategy(),
    new UnicodeAnalysisStrategy(),
    new StructuralStrategy(),
    new ExfiltrationStrategy(),
  ];
}

export class PromptInjectionScanner {
  private strategies: ScanStrategy[];

  constructor(strategies?: ScanStrategy[]) {
    this.strategies = strategies ?? defaultStrategies();
  }

  scan(params: Record<string, unknown>): ThreatScanResult {
    const startTime = performance.now();
    const indicators: ThreatIndicator[] = [];

    const strings = this.extractStrings(params, "params");
    for (const { value, path } of strings) {
      for (const strategy of this.strategies) {
        const results = strategy.scan(value, path);
        indicators.push(...results);
      }
    }

    const scanDurationMs = performance.now() - startTime;

    let highestSeverity: ThreatIndicator["severity"] | null = null;
    for (const severity of SEVERITY_ORDER) {
      if (indicators.some((i) => i.severity === severity)) {
        highestSeverity = severity;
        break;
      }
    }

    return {
      clean: indicators.length === 0,
      indicators,
      highestSeverity,
      scanDurationMs,
    };
  }

  /**
   * Block on critical or high severity threats.
   */
  shouldBlock(result: ThreatScanResult): boolean {
    return (
      result.highestSeverity === "critical" ||
      result.highestSeverity === "high"
    );
  }

  private extractStrings(
    obj: unknown,
    path: string
  ): Array<{ value: string; path: string }> {
    const results: Array<{ value: string; path: string }> = [];

    if (typeof obj === "string") {
      if (obj.length > 0) {
        results.push({ value: obj, path });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        results.push(...this.extractStrings(item, `${path}[${index}]`));
      });
    } else if (obj !== null && typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        results.push(...this.extractStrings(value, `${path}.${key}`));
      }
    }

    return results;
  }
}

// Singleton for default usage
let _scanner: PromptInjectionScanner | null = null;

export function getScanner(): PromptInjectionScanner {
  if (!_scanner) {
    _scanner = new PromptInjectionScanner();
  }
  return _scanner;
}

/**
 * Reset the singleton. Mostly useful for tests + for callers that want to
 * inject custom strategies (e.g. AtlassianInjectionStrategy from cloud) at
 * boot time.
 */
export function setScanner(scanner: PromptInjectionScanner): void {
  _scanner = scanner;
}
