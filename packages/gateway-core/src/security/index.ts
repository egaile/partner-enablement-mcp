export type { ScanStrategy, ThreatIndicator, ThreatScanResult } from "./types.js";
export {
  PromptInjectionScanner,
  defaultStrategies,
  getScanner,
  setScanner,
  registerScanStrategy,
} from "./scanner.js";
export { PatternMatchStrategy } from "./strategies/pattern-match.js";
export { UnicodeAnalysisStrategy } from "./strategies/unicode-analysis.js";
export { StructuralStrategy } from "./strategies/structural.js";
export {
  ExfiltrationStrategy,
  type ExfiltrationStrategyOptions,
  registerExfiltrationExemptDomain,
  resetExfiltrationExemptDomains,
} from "./strategies/exfiltration.js";
export {
  scanForPii,
  redactPii,
  registerPiiPattern,
  resetPiiRegistry,
  listPiiPatterns,
  type PiiMatch,
  type PiiScanResult,
  type PiiScanOptions,
  type PiiPatternEntry,
} from "./pii-scanner.js";
export { RateLimiter, type RateLimitResult } from "./rate-limiter.js";
