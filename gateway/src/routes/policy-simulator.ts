import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { AuthenticatedRequest } from "../auth/types.js";
import { PolicyEngine } from "../policy/engine.js";
import { getScanner } from "../security/scanner.js";
import { SimulatePolicySchema } from "../schemas/index.js";
import type { GatewayState } from "./types.js";

export function createPolicySimulatorRouter(state: GatewayState): Router {
  const router = Router();
  const simulatorPolicyEngine = new PolicyEngine();

  router.post(
    "/api/policies/simulate",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = SimulatePolicySchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ error: parsed.error.issues });
          return;
        }
        const { serverName, toolName, userId, params } = parsed.data;

        const decision = await simulatorPolicyEngine.evaluate(
          req.tenant!.tenantId,
          { serverName, toolName, userId: userId || req.tenant!.userId }
        );

        const scanner = getScanner();
        const scanResult = params ? scanner.scan(params) : null;

        res.json({
          decision: decision.action,
          matchedRule: decision.ruleId
            ? { ruleId: decision.ruleId, ruleName: decision.ruleName, action: decision.action }
            : null,
          modifiers: decision.modifiers,
          scanResult: scanResult
            ? { clean: scanResult.clean, threatCount: scanResult.indicators.length, highestSeverity: scanResult.highestSeverity }
            : null,
          wouldBeBlocked: decision.action === "deny" || (scanResult ? scanner.shouldBlock(scanResult) : false),
          reason: decision.action === "deny"
            ? `Blocked by policy "${decision.ruleName}"`
            : scanResult && scanner.shouldBlock(scanResult)
              ? `Blocked by threat detection (${scanResult.highestSeverity})`
              : "Allowed",
        });
      } catch (error) {
        res.status(500).json({ error: state.safeErrorMessage(error) });
      }
    }
  );

  return router;
}
