# Deployment Guide

The MCP Security Gateway stack consists of three services:

| Service | Platform | URL |
|---------|----------|-----|
| Gateway (Express) | Railway | `https://gateway-production-b077.up.railway.app` |
| Dashboard (Next.js) | Vercel | Your Vercel deployment URL |
| Database (Postgres) | Supabase | `https://your-project.supabase.co` |

Authentication is handled by Clerk (hosted SaaS).

## Prerequisites

- A [Supabase](https://supabase.com) project with migrations applied
- A [Clerk](https://clerk.com) application
- A [Railway](https://railway.app) account
- A [Vercel](https://vercel.com) account

## Supabase setup

1. Create a new Supabase project.
2. Apply the database migrations in order:

   ```bash
   # Using the Supabase CLI
   cd gateway
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   Or paste each SQL file from `gateway/supabase/migrations/` into the Supabase SQL editor.

3. Seed the default tenant:

   ```sql
   INSERT INTO tenants (id, name, slug)
   VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default');
   ```

4. Note your **Supabase URL** and **Service Role Key** from Project Settings > API.

## Clerk setup

1. Create a new Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Configure sign-in methods (email, Google, etc.).
3. Note your **Publishable Key** (starts with `pk_`) and **Secret Key** (starts with `sk_`).

## Deploying the gateway on Railway

### Option 1: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Link to the gateway directory
cd gateway

# Set environment variables
railway variables set SUPABASE_URL=https://your-project.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=eyJ...
railway variables set CLERK_SECRET_KEY=sk_live_...
railway variables set PORT=4000
railway variables set LOG_LEVEL=info
railway variables set ALLOWED_ORIGINS=https://your-dashboard.vercel.app

# Deploy
railway up
```

### Option 2: Railway dashboard

1. Create a new project on [railway.app](https://railway.app).
2. Connect your GitHub repository.
3. Set the root directory to `gateway`.
4. Railway will detect `railway.json` in the gateway directory for build configuration.
5. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CLERK_SECRET_KEY`
   - `PORT` = `4000`
   - `LOG_LEVEL` = `info`
   - `ALLOWED_ORIGINS` = your dashboard URL

### Railway build configuration

The gateway includes a `railway.json` file:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

Railway uses Nixpacks to detect Node.js, runs `npm install` and `npm run build` (tsc), then starts with `npm start` (`node dist/index.js`).

### Verify deployment

```bash
curl https://gateway-production-b077.up.railway.app/health
# {"status":"healthy","service":"mcp-security-gateway"}
```

## Deploying the dashboard on Vercel

1. Import the repository on [vercel.com](https://vercel.com/new).
2. Set the **Root Directory** to `dashboard`.
3. Set the **Build Command** to `npm run build`.
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = your Clerk publishable key
   - `CLERK_SECRET_KEY` = your Clerk secret key
   - `GATEWAY_API_URL` = your Railway gateway URL (e.g., `https://gateway-production-b077.up.railway.app`)
5. Deploy.

## Self-hosted deployment

### Docker

Create a `Dockerfile` in the gateway directory:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build
RUN npm prune --production
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

Build and run:

```bash
docker build -t mcp-gateway .
docker run -p 4000:4000 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  -e CLERK_SECRET_KEY=sk_live_... \
  -e PORT=4000 \
  -e LOG_LEVEL=info \
  mcp-gateway
```

### Bare metal / VM

```bash
cd gateway
npm install
npm run build
NODE_ENV=production node dist/index.js
```

Use a process manager like `pm2` for production:

```bash
npm install -g pm2
pm2 start dist/index.js --name mcp-gateway
pm2 save
pm2 startup
```

## CORS configuration

The gateway allows CORS requests from:
- `http://localhost:3001` (always included for local development)
- Any origin ending in `.vercel.app`
- Origins listed in the `ALLOWED_ORIGINS` environment variable (comma-separated)

For production, set `ALLOWED_ORIGINS` to your dashboard's actual domain:

```bash
ALLOWED_ORIGINS=https://your-dashboard.vercel.app,https://dashboard.yourdomain.com
```

## Graceful shutdown

The gateway handles `SIGTERM` and `SIGINT` signals:
1. Stops accepting new HTTP connections
2. Flushes buffered audit log entries to Supabase
3. Stops health checker timers
4. Disconnects all downstream MCP servers
5. Closes MCP session transports

Railway sends `SIGTERM` during deploys. The gateway handles this gracefully to avoid losing audit data.

## Health checks

The `/health` endpoint returns:

```json
{ "status": "healthy", "service": "mcp-security-gateway" }
```

Railway uses this for deployment health checks (30-second timeout). The endpoint is unauthenticated and lightweight.

## Scaling considerations

- **Memory**: The gateway holds per-tenant engine instances, MCP transports, and rate limiter windows in memory. Each tenant engine maintains connections to downstream servers. Monitor memory usage if supporting many tenants.
- **Stale transports**: MCP session transports are cleaned up after 30 minutes of inactivity.
- **Audit buffer**: Failed Supabase writes are retried on the next flush cycle. Entries are kept in memory until successfully written.
- **Horizontal scaling**: The current architecture assumes a single gateway instance per tenant. Horizontal scaling would require shared state for rate limiting and session management.
