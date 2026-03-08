# Configuration Reference

All gateway configuration is managed through environment variables, validated at startup by Zod.

## Required variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL. | `https://abcdefgh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key. Bypasses RLS for gateway operations. | `eyJhbGciOi...` |
| `CLERK_SECRET_KEY` | Clerk secret key for JWT verification. Set to `"dev"` for dev mode. | `sk_live_...` or `dev` |

## Optional variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Port the gateway listens on. |
| `LOG_LEVEL` | `info` | Log verbosity. One of: `debug`, `info`, `warn`, `error`. |
| `ALLOWED_ORIGINS` | (empty) | Comma-separated list of allowed CORS origins. `http://localhost:3001` is always allowed. Any `*.vercel.app` origin is also allowed by default. |
| `AUDIT_FLUSH_INTERVAL_MS` | `5000` | How often the audit logger flushes buffered entries to Supabase (in milliseconds). |
| `AUDIT_BATCH_SIZE` | `50` | Maximum number of audit entries per Supabase insert batch. Also triggers an immediate flush when the buffer reaches this size. |
| `POLICY_CACHE_TTL_MS` | `30000` | How long policy rules are cached in memory per tenant (in milliseconds). |
| `STRIPE_SECRET_KEY` | (empty) | Stripe secret key for billing integration. Required for plan upgrades and usage metering. |
| `STRIPE_WEBHOOK_SECRET` | (empty) | Stripe webhook signing secret for verifying incoming webhook events. |
| `USAGE_FLUSH_INTERVAL_MS` | `60000` | How often usage meter data is flushed to Supabase (in milliseconds). |

## Dev mode

When `CLERK_SECRET_KEY` is set to the literal string `"dev"`:

- Clerk JWT verification is skipped entirely
- All requests are mapped to the user ID `dev_user`
- The `dev_user` must exist in the `tenant_users` table (created during seeding)

This is intended for local development only. Never use dev mode in production.

## Configuration validation

The gateway validates all configuration at startup using Zod's `safeParse`. If any required variable is missing or has an invalid format, the gateway prints a detailed error and exits:

```
Invalid gateway configuration:
  supabaseUrl: Required
  supabaseServiceRoleKey: Required
  clerkSecretKey: Required
```

The configuration schema is defined in `src/config.ts`:

```typescript
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
```

## Environment variable mapping

| Environment Variable | Config Property |
|---------------------|-----------------|
| `PORT` | `port` |
| `LOG_LEVEL` | `logLevel` |
| `SUPABASE_URL` | `supabaseUrl` |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabaseServiceRoleKey` |
| `CLERK_SECRET_KEY` | `clerkSecretKey` |
| `AUDIT_FLUSH_INTERVAL_MS` | `auditFlushIntervalMs` |
| `AUDIT_BATCH_SIZE` | `auditBatchSize` |
| `POLICY_CACHE_TTL_MS` | `policyCacheTtlMs` |

## Tuning guidelines

### Audit flush interval

- **Lower values** (e.g., 1000ms): More frequent writes, less data loss on crash, higher Supabase load.
- **Higher values** (e.g., 30000ms): Fewer writes, better throughput, but more data at risk in the buffer.

For production, the default of 5000ms is a reasonable balance.

### Audit batch size

- **Smaller batches** (e.g., 10): More frequent inserts but smaller payloads.
- **Larger batches** (e.g., 200): Fewer inserts, more efficient, but larger payloads that may hit Supabase row limits.

The default of 50 works well for most deployments.

### Policy cache TTL

- **Shorter TTL** (e.g., 5000ms): Policy changes take effect faster, but more frequent database queries.
- **Longer TTL** (e.g., 120000ms): Less database load, but policy changes take longer to propagate.

For environments where policies change frequently during setup, consider lowering to 5-10 seconds. For stable production environments, 30-60 seconds is appropriate.

## Dashboard environment variables

The admin dashboard (Next.js) uses a separate set of environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client-side). | `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client-side, RLS-protected). | `eyJhbGciOi...` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (client-side). | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side). | `sk_test_...` |
| `GATEWAY_API_URL` | Base URL of the gateway REST API. | `http://localhost:4000` |
