import type { Express } from "express";
import type { GatewayState } from "./types.js";

import { createMcpProxyRouter } from "./mcp-proxy.js";
import { createServersRouter } from "./servers.js";
import { createPoliciesRouter } from "./policies.js";
import { createAuditRouter } from "./audit.js";
import { createAlertsRouter } from "./alerts.js";
import { createSnapshotsRouter } from "./snapshots.js";
import { createHealthRouter } from "./health.js";
import { createOAuthRouter } from "./oauth.js";
import { createPolicySimulatorRouter } from "./policy-simulator.js";
import { createApiKeysRouter } from "./api-keys.js";
import { createTeamRouter } from "./team.js";
import { createApprovalsRouter } from "./approvals.js";
import { createWebhooksRouter } from "./webhooks.js";
import { createTemplatesRouter } from "./templates.js";
import { createBillingRouter } from "./billing.js";
import { createDashboardRouter } from "./dashboard.js";

export function registerRoutes(app: Express, state: GatewayState): void {
  app.use(createMcpProxyRouter(state));
  app.use(createServersRouter(state));
  app.use(createPoliciesRouter(state));
  app.use(createAuditRouter(state));
  app.use(createAlertsRouter(state));
  app.use(createSnapshotsRouter(state));
  app.use(createHealthRouter(state));
  app.use(createOAuthRouter(state));
  app.use(createPolicySimulatorRouter(state));
  app.use(createApiKeysRouter(state));
  app.use(createTeamRouter(state));
  app.use(createApprovalsRouter(state));
  app.use(createWebhooksRouter(state));
  app.use(createTemplatesRouter(state));
  app.use(createBillingRouter(state));
  app.use(createDashboardRouter(state));
}
