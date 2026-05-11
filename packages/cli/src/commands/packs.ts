/**
 * `mcpshield packs list` — show packs configured in mcpshield.yaml and
 * attempt to load each one to surface install / shape errors at admin
 * time rather than at gateway-start time.
 */

import { loadConfig, loadPacks } from "@mcpshield/gateway-core";
import { resolveConfigPath } from "../lib/paths.js";

export interface PacksListOptions {
  configPath?: string;
}

export async function runPacksList(
  options: PacksListOptions = {}
): Promise<void> {
  const configPath = resolveConfigPath(options.configPath);
  const config = await loadConfig({ path: configPath });

  if (config.packs.length === 0) {
    console.log("No packs configured.");
    console.log(
      "Add e.g. `packs: [\"@mcpshield/pack-healthcare\"]` to mcpshield.yaml."
    );
    return;
  }

  const result = await loadPacks(config.packs);
  for (const ok of result.loaded) {
    console.log(`✓ ${ok.source}`);
    console.log(
      `    ${ok.pack.name} — ${ok.pack.pii.length} PII patterns, ${ok.pack.policyTemplates.length} templates, compliance: ${ok.pack.compliance.map((c) => c.id).join(", ") || "(none)"}`
    );
  }
  for (const fail of result.failed) {
    console.log(`✗ ${fail.source}`);
    console.log(`    ${fail.reason}`);
  }
}
