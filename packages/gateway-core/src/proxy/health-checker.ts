/**
 * HealthChecker — periodic `tools/list` ping against every downstream
 * connection. Fires `server_error` alerts once a server crosses the
 * consecutive-failure threshold.
 *
 * Owns no storage; status is in-memory only and rebuilt on engine restart.
 * Cloud overlays a richer status surface on top of this via its dashboard
 * route — the routes read `getAllStatuses()`.
 */

import type { ConnectionManager } from "./connection-manager.js";
import type { DownstreamConnection } from "./types.js";
import type { AlertSink } from "./ports.js";

export interface HealthStatus {
  serverId: string;
  serverName: string;
  status: "healthy" | "degraded" | "unreachable";
  latencyMs: number | null;
  consecutiveFailures: number;
  lastChecked: string;
}

export interface HealthCheckerOptions {
  connectionManager: ConnectionManager;
  alertSink: AlertSink;
  tenantId: string;
  /** Polling interval. Defaults to 60s. */
  intervalMs?: number;
  /** Consecutive failures before firing an alert. Defaults to 3. */
  failureThreshold?: number;
  /** Latency above which a healthy ping is reported as `degraded`. Defaults to 5000ms. */
  degradedLatencyMs?: number;
}

export class HealthChecker {
  private statuses = new Map<string, HealthStatus>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly connectionManager: ConnectionManager;
  private readonly alertSink: AlertSink;
  private readonly tenantId: string;
  private readonly intervalMs: number;
  private readonly failureThreshold: number;
  private readonly degradedLatencyMs: number;

  constructor(options: HealthCheckerOptions) {
    this.connectionManager = options.connectionManager;
    this.alertSink = options.alertSink;
    this.tenantId = options.tenantId;
    this.intervalMs = options.intervalMs ?? 60_000;
    this.failureThreshold = options.failureThreshold ?? 3;
    this.degradedLatencyMs = options.degradedLatencyMs ?? 5_000;
  }

  start(): void {
    if (this.timer) return;
    this.checkAll().catch((err) =>
      console.error("[health] Initial check failed:", err)
    );
    this.timer = setInterval(() => {
      this.checkAll().catch((err) =>
        console.error("[health] Check failed:", err)
      );
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus(serverId: string): HealthStatus | undefined {
    return this.statuses.get(serverId);
  }

  getAllStatuses(): HealthStatus[] {
    return Array.from(this.statuses.values());
  }

  private async checkAll(): Promise<void> {
    const connections = this.connectionManager.getAllConnections();
    await Promise.allSettled(connections.map((conn) => this.checkOne(conn)));
  }

  private async checkOne(conn: DownstreamConnection): Promise<void> {
    const existing = this.statuses.get(conn.serverId);
    const start = performance.now();

    try {
      await conn.client.listTools();
      const latencyMs = Math.round(performance.now() - start);

      this.statuses.set(conn.serverId, {
        serverId: conn.serverId,
        serverName: conn.serverName,
        status: latencyMs > this.degradedLatencyMs ? "degraded" : "healthy",
        latencyMs,
        consecutiveFailures: 0,
        lastChecked: new Date().toISOString(),
      });
    } catch (error) {
      const failures = (existing?.consecutiveFailures ?? 0) + 1;
      this.statuses.set(conn.serverId, {
        serverId: conn.serverId,
        serverName: conn.serverName,
        status:
          failures >= this.failureThreshold ? "unreachable" : "degraded",
        latencyMs: null,
        consecutiveFailures: failures,
        lastChecked: new Date().toISOString(),
      });

      if (failures === this.failureThreshold) {
        this.alertSink
          .fireServerError(this.tenantId, {
            serverId: conn.serverId,
            serverName: conn.serverName,
            errorMessage:
              error instanceof Error ? error.message : "Health check failed",
            errorType: "health_check_failure",
          })
          .catch((err) =>
            console.error("[health] Failed to fire server error alert:", err)
          );
      }
    }
  }
}
