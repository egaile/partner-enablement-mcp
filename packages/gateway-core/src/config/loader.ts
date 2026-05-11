/**
 * YAML config loader for `mcpshield.yaml`.
 *
 * Reads, parses, validates, and (optionally) watches the config file for hot
 * reload. The file is the OSS source of truth for servers, policies, and
 * pack selection.
 *
 * Usage:
 *   const config = await loadConfig({ path: "./mcpshield.yaml" });
 *   const watcher = watchConfig({ path: "./mcpshield.yaml" }, (next) => {
 *     // re-apply config to the running gateway
 *   });
 *   // ...
 *   watcher.stop();
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import yaml from "js-yaml";
import chokidar, { type FSWatcher } from "chokidar";
import {
  McpShieldConfigSchema,
  type McpShieldConfig,
} from "./schema.js";

export class ConfigError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface LoadConfigOptions {
  path: string;
}

export async function loadConfig(
  options: LoadConfigOptions
): Promise<McpShieldConfig> {
  const abs = resolve(options.path);
  let raw: string;
  try {
    raw = await readFile(abs, "utf-8");
  } catch (err) {
    throw new ConfigError(`Failed to read config at ${abs}`, err);
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw, { schema: yaml.JSON_SCHEMA });
  } catch (err) {
    throw new ConfigError(`Failed to parse YAML at ${abs}`, err);
  }

  // Empty file is valid; treat as defaults.
  if (parsed == null) parsed = {};

  const result = McpShieldConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`Invalid config at ${abs}:\n${issues}`);
  }

  return result.data;
}

export interface WatchOptions {
  path: string;
  /** Debounce window for fs events (ms). Defaults to 200ms. */
  debounceMs?: number;
}

export interface ConfigWatcher {
  stop(): Promise<void>;
}

export type ConfigChangeListener = (
  next: McpShieldConfig | null,
  err: ConfigError | null
) => void;

/**
 * Watch the config file. The listener is invoked on every change with either
 * the new validated config or a ConfigError describing what went wrong.
 *
 * Returns a handle for stopping the watcher.
 */
export function watchConfig(
  options: WatchOptions,
  listener: ConfigChangeListener
): ConfigWatcher {
  const abs = resolve(options.path);
  const debounceMs = options.debounceMs ?? 200;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const reload = (): void => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      loadConfig({ path: abs })
        .then((cfg) => listener(cfg, null))
        .catch((err) => {
          if (err instanceof ConfigError) {
            listener(null, err);
          } else {
            listener(null, new ConfigError("Unexpected reload error", err));
          }
        });
    }, debounceMs);
  };

  const watcher: FSWatcher = chokidar.watch(abs, {
    persistent: true,
    // Don't fire on the initial `add` when chokidar first discovers the
    // file — the caller has already loaded it explicitly via loadConfig().
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  watcher.on("change", reload);
  watcher.on("add", reload);

  return {
    stop: async (): Promise<void> => {
      if (timeout) clearTimeout(timeout);
      await watcher.close();
    },
  };
}
