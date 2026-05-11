export {
  McpShieldConfigSchema,
  type McpShieldConfig,
  type ServerConfigEntry,
  type PolicyConfigEntry,
} from "./schema.js";

export {
  loadConfig,
  watchConfig,
  ConfigError,
  type LoadConfigOptions,
  type WatchOptions,
  type ConfigWatcher,
  type ConfigChangeListener,
} from "./loader.js";
