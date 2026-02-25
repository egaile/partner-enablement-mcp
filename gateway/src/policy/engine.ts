import picomatch from "picomatch";
import {
  getPoliciesForTenant,
  type PolicyRuleRecord,
} from "../db/queries/policies.js";
import type { PolicyDecision } from "./types.js";
import { loadConfig } from "../config.js";

interface CacheEntry {
  rules: PolicyRuleRecord[];
  expiresAt: number;
}

export class PolicyEngine {
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs: number;

  constructor(cacheTtlMs?: number) {
    this.cacheTtlMs = cacheTtlMs ?? loadConfig().policyCacheTtlMs;
  }

  async evaluate(
    tenantId: string,
    context: {
      serverName: string;
      toolName: string;
      userId?: string;
    }
  ): Promise<PolicyDecision> {
    const rules = await this.getRules(tenantId);

    // Evaluate rules in priority order (lower = higher priority)
    for (const rule of rules) {
      if (this.matchesConditions(rule, context)) {
        return {
          action: rule.action,
          ruleId: rule.id,
          ruleName: rule.name,
          modifiers: rule.modifiers ?? {},
        };
      }
    }

    // Default: allow
    return {
      action: "allow",
      ruleId: null,
      ruleName: null,
      modifiers: {},
    };
  }

  clearCache(tenantId?: string): void {
    if (tenantId) {
      this.cache.delete(tenantId);
    } else {
      this.cache.clear();
    }
  }

  private async getRules(tenantId: string): Promise<PolicyRuleRecord[]> {
    const now = Date.now();
    const cached = this.cache.get(tenantId);

    if (cached && cached.expiresAt > now) {
      return cached.rules;
    }

    const rules = await getPoliciesForTenant(tenantId);
    this.cache.set(tenantId, {
      rules,
      expiresAt: now + this.cacheTtlMs,
    });

    return rules;
  }

  private matchesConditions(
    rule: PolicyRuleRecord,
    context: { serverName: string; toolName: string; userId?: string }
  ): boolean {
    const { conditions } = rule;

    // Check server match
    if (conditions.servers && conditions.servers.length > 0) {
      const matched = conditions.servers.some((pattern) =>
        picomatch.isMatch(context.serverName, pattern)
      );
      if (!matched) return false;
    }

    // Check tool match
    if (conditions.tools && conditions.tools.length > 0) {
      const matched = conditions.tools.some((pattern) =>
        picomatch.isMatch(context.toolName, pattern)
      );
      if (!matched) return false;
    }

    // Check user match
    if (conditions.users && conditions.users.length > 0) {
      if (!context.userId || !conditions.users.includes(context.userId)) {
        return false;
      }
    }

    // Check time window
    if (conditions.timeWindows && conditions.timeWindows.length > 0) {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();

      const inWindow = conditions.timeWindows.some((window) => {
        if (window.daysOfWeek && !window.daysOfWeek.includes(day)) {
          return false;
        }
        if (window.startHour !== undefined && hour < window.startHour) {
          return false;
        }
        if (window.endHour !== undefined && hour >= window.endHour) {
          return false;
        }
        return true;
      });

      if (!inWindow) return false;
    }

    return true;
  }
}
