/**
 * PolicyEngine — evaluates a tenant's policy rules against an incoming
 * tool-call context (server, tool, user, time of day) and returns a decision
 * (allow / deny / require_approval / log_only).
 *
 * Storage is injected via a `policies: PoliciesPort` port. Both the SQLite
 * (OSS) and Supabase (cloud) backends satisfy this port via their
 * StorageBackend.policies implementations.
 *
 * Cached per-tenant with a configurable TTL to keep the hot path fast.
 */

import picomatch from "picomatch";
import type { PolicyRuleRecord } from "../storage/types.js";
import type { PolicyDecision } from "./types.js";

export interface PoliciesPort {
  listEnabledForTenant(tenantId: string): Promise<PolicyRuleRecord[]>;
}

export interface PolicyEngineOptions {
  policies: PoliciesPort;
  /** Cache TTL in ms. Defaults to 30 seconds. */
  cacheTtlMs?: number;
}

interface CacheEntry {
  rules: PolicyRuleRecord[];
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 30_000;

export class PolicyEngine {
  private cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;
  private readonly policies: PoliciesPort;

  constructor(options: PolicyEngineOptions) {
    this.policies = options.policies;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
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

    // Default: allow when no rule matches.
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

  /** Remove expired entries to prevent unbounded growth. */
  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private async getRules(tenantId: string): Promise<PolicyRuleRecord[]> {
    this.pruneExpired();

    const now = Date.now();
    const cached = this.cache.get(tenantId);

    if (cached && cached.expiresAt > now) {
      return cached.rules;
    }

    const rules = await this.policies.listEnabledForTenant(tenantId);
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

    if (conditions.servers && conditions.servers.length > 0) {
      const matched = conditions.servers.some((pattern) =>
        picomatch.isMatch(context.serverName, pattern)
      );
      if (!matched) return false;
    }

    if (conditions.tools && conditions.tools.length > 0) {
      const matched = conditions.tools.some((pattern) =>
        picomatch.isMatch(context.toolName, pattern)
      );
      if (!matched) return false;
    }

    if (conditions.users && conditions.users.length > 0) {
      if (!context.userId || !conditions.users.includes(context.userId)) {
        return false;
      }
    }

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
