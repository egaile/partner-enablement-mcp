import "dotenv/config";
import { z } from "zod";

const ConfigSchema = z.object({
  port: z.coerce.number().default(4000),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  supabaseUrl: z.string().min(1),
  supabaseServiceRoleKey: z.string().min(1),
  clerkSecretKey: z.string().min(1),
  auditFlushIntervalMs: z.coerce.number().default(5000),
  auditBatchSize: z.coerce.number().default(50),
  policyCacheTtlMs: z.coerce.number().default(30000),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;

  const result = ConfigSchema.safeParse({
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
    auditFlushIntervalMs: process.env.AUDIT_FLUSH_INTERVAL_MS,
    auditBatchSize: process.env.AUDIT_BATCH_SIZE,
    policyCacheTtlMs: process.env.POLICY_CACHE_TTL_MS,
  });

  if (!result.success) {
    const missing = result.error.issues.map(
      (i) => `  ${i.path.join(".")}: ${i.message}`
    );
    throw new Error(
      `Invalid gateway configuration:\n${missing.join("\n")}`
    );
  }

  _config = result.data;
  return _config;
}
