/**
 * Cloud gateway scanner — composes gateway-core's generic strategies with
 * the Atlassian-aware injection scanner that's part of the closed-source
 * cloud build.
 */

import {
  PromptInjectionScanner as CoreScanner,
  defaultStrategies,
  type ScanStrategy,
} from "@mcpshield/gateway-core/security";
import { AtlassianInjectionStrategy } from "./patterns/atlassian.js";
import { ExfiltrationStrategy } from "./strategies/exfiltration.js";

export { PromptInjectionScanner } from "@mcpshield/gateway-core/security";

/**
 * Default scanner for the cloud gateway. Replaces the core ExfiltrationStrategy
 * with the Atlassian-aware variant and appends the AtlassianInjectionStrategy.
 */
export function gatewayDefaultStrategies(): ScanStrategy[] {
  const core = defaultStrategies();
  // Swap in Atlassian-aware exfiltration variant
  const swapped = core.map((s) =>
    s.name === "exfiltration" ? new ExfiltrationStrategy() : s
  );
  return [...swapped, new AtlassianInjectionStrategy()];
}

let _scanner: CoreScanner | null = null;

export function getScanner(): CoreScanner {
  if (!_scanner) {
    _scanner = new CoreScanner(gatewayDefaultStrategies());
  }
  return _scanner;
}

export function setScanner(scanner: CoreScanner): void {
  _scanner = scanner;
}
