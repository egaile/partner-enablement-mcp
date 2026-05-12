/**
 * Cloud gateway scanner — re-exports gateway-core's singleton.
 *
 * Pack-contributed strategies (e.g. the Atlassian injection scanner from
 * @mcpshield/pack-atlassian) are appended to the default core strategies
 * via `registerScanStrategy()` when the pack loads at boot. Same for
 * exfiltration exempt domains — handled by the pack loader.
 *
 * This shim exists only to preserve the import path used by route
 * modules; nothing cloud-specific lives here anymore.
 */

export {
  PromptInjectionScanner,
  defaultStrategies,
  getScanner,
  setScanner,
} from "@mcpshield/gateway-core/security";
