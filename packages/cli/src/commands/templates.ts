/**
 * `mcpshield templates list [--category <c>]` and `templates apply <id>`.
 *
 * Templates come from `pack.policyTemplates` on every pack listed in
 * `mcpshield.yaml` under `packs:`. `apply` upserts each rule of the
 * matched template as a tenant policy with a deterministic externalId
 * so re-running is idempotent.
 */

import {
  SqliteStorageBackend,
  loadConfig,
  loadPacks,
  type LoadedPack,
} from "@mcpshield/gateway-core";
import type { PolicyTemplate } from "@mcpshield/sdk";
import { resolveConfigPath, resolveDbPath } from "../lib/paths.js";

export interface TemplatesListOptions {
  configPath?: string;
  category?: string;
}

export async function runTemplatesList(
  options: TemplatesListOptions = {}
): Promise<void> {
  const { loaded } = await resolveLoadedPacks(options.configPath);
  if (loaded.length === 0) {
    console.log("No packs loaded — add packs to mcpshield.yaml under `packs:`.");
    return;
  }

  let printed = 0;
  for (const { source, pack } of loaded) {
    const filtered = options.category
      ? pack.policyTemplates.filter((t) => t.category === options.category)
      : pack.policyTemplates;
    if (filtered.length === 0) continue;
    console.log(`# ${source}`);
    for (const t of filtered) {
      console.log(
        `  ${t.id}  [${t.category}]  ${t.name}  (${t.rules.length} rule${t.rules.length === 1 ? "" : "s"})`
      );
      if (t.description) {
        console.log(`    ${t.description}`);
      }
      printed += 1;
    }
    console.log("");
  }

  if (printed === 0) {
    if (options.category) {
      console.log(`No templates in category "${options.category}".`);
    } else {
      console.log("Loaded packs export no templates.");
    }
  } else {
    console.log(
      `Apply with: mcpshield templates apply <id>   (e.g. mcpshield templates apply hipaa_phi_shield)`
    );
  }
}

export interface TemplatesApplyOptions {
  configPath?: string;
  id?: string;
}

export async function runTemplatesApply(
  options: TemplatesApplyOptions = {}
): Promise<void> {
  if (!options.id) {
    console.error("Missing template id. Run `mcpshield templates list` first.");
    process.exit(1);
  }

  const configPath = resolveConfigPath(options.configPath);
  const config = await loadConfig({ path: configPath });
  const dbPath = resolveDbPath(configPath, config.audit.path);

  const packResult = await loadPacks(config.packs);
  for (const fail of packResult.failed) {
    console.error(`[mcpshield] Failed to load pack ${fail.source}: ${fail.reason}`);
  }

  const match = findTemplate(packResult.loaded, options.id);
  if (!match) {
    console.error(
      `Template "${options.id}" not found in any loaded pack. Run \`mcpshield templates list\` to see available ids.`
    );
    process.exit(1);
  }
  const { source, template } = match;

  const storage = new SqliteStorageBackend({ path: dbPath });
  await storage.init();
  try {
    const tenant = await storage.tenants.getOrCreateDefault();
    const applied: string[] = [];
    for (const rule of template.rules) {
      const externalId = `${tenant.id}:template:${template.id}:${rule.name}`;
      const upserted = await storage.policies.upsert({
        externalId,
        tenantId: tenant.id,
        name: `[${template.name}] ${rule.name}`,
        description: rule.description,
        priority: rule.priority,
        conditions: rule.conditions,
        action: rule.action,
        modifiers: rule.modifiers ?? null,
        enabled: true,
      });
      applied.push(upserted.name);
    }

    console.log(
      `Applied template "${template.id}" from ${source}: ${applied.length} rule${applied.length === 1 ? "" : "s"} upserted.`
    );
    for (const name of applied) {
      console.log(`  - ${name}`);
    }
    console.log("");
    console.log(
      "Re-applying is idempotent (same externalId). Inspect with: mcpshield policies list"
    );
  } finally {
    await storage.close();
  }
}

async function resolveLoadedPacks(
  configPath?: string
): Promise<{ loaded: LoadedPack[] }> {
  const path = resolveConfigPath(configPath);
  const config = await loadConfig({ path });
  if (config.packs.length === 0) {
    return { loaded: [] };
  }
  const result = await loadPacks(config.packs);
  for (const fail of result.failed) {
    console.error(`[mcpshield] Failed to load pack ${fail.source}: ${fail.reason}`);
  }
  return { loaded: result.loaded };
}

function findTemplate(
  packs: LoadedPack[],
  id: string
): { source: string; template: PolicyTemplate } | null {
  const matches: Array<{ source: string; template: PolicyTemplate }> = [];
  for (const { source, pack } of packs) {
    for (const t of pack.policyTemplates) {
      if (t.id === id) matches.push({ source, template: t });
    }
  }
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn(
      `[mcpshield] Warning: template id "${id}" exists in multiple packs: ${matches.map((m) => m.source).join(", ")}. Using ${matches[0].source}.`
    );
  }
  return matches[0];
}
