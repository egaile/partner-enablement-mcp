# Build context is the repo root, not gateway/. The gateway depends on the
# @mcpshield/* workspace packages, which aren't published to npm.
#   docker build -f gateway/Dockerfile .
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/gateway-core/package.json packages/gateway-core/
COPY packs-private/pack-atlassian/package.json packs-private/pack-atlassian/
COPY gateway/package.json gateway/
RUN npm ci --no-audit --no-fund \
  -w @mcpshield/sdk \
  -w @mcpshield/gateway-core \
  -w @mcpshield/pack-atlassian \
  -w mcp-security-gateway

COPY packages/sdk packages/sdk
COPY packages/gateway-core packages/gateway-core
COPY packs-private/pack-atlassian packs-private/pack-atlassian
COPY gateway gateway
RUN npm run -w @mcpshield/sdk build \
  && npm run -w @mcpshield/gateway-core build \
  && npm run -w @mcpshield/pack-atlassian build \
  && npm run -w mcp-security-gateway build \
  && npm prune --omit=dev --no-audit --no-fund \
    -w @mcpshield/sdk \
    -w @mcpshield/gateway-core \
    -w @mcpshield/pack-atlassian \
    -w mcp-security-gateway

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Copy the whole pruned workspace: packages can have their own nested
# node_modules when versions conflict with the root.
COPY --from=builder /app /app

WORKDIR /app/gateway
# node:20-slim ships an unprivileged `node` user. The gateway holds the
# Supabase service-role key, so don't run it as root. Files stay owned by root
# (readable, not writable) so the process can't rewrite its own code.
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
