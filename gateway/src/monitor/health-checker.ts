import type { ConnectionManager, DownstreamConnection } from "../proxy/connection-manager.js";
import { AlertEngine } from "../alerts/engine.js";

export interface HealthStatus {
  serverId: string;
  serverName: string;
  status: "healthy" | "degraded" | "unreachable";
  latencyMs: number | null;
  consecutiveFailures: number;
  lastChecked: string;
}

export class HealthChecker {
  private statuses = new Map<string, HealthStatus>();
  private timer: NodeJS.Timeout | null = null;
  private connectionManager: ConnectionManager;
  private alertEngine: AlertEngine;
  private tenantId: string;
  private readonly intervalMs: number;
  private readonly failureThreshold = 3;

  constructor(
    connectionManager: ConnectionManager,
    alertEngine: AlertEngine,
    tenantId: string,
    intervalMs = 60_000
  ) {
    this.connectionManager = connectionManager;
    this.alertEngine = alertEngine;
    this.tenantId = tenantId;
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.timer) return;
    // Run immediately, then every intervalMs
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
    await Promise.allSettled(
      connections.map((conn) => this.checkOne(conn))
    );
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
        status: latencyMs > 5000 ? "degraded" : "healthy",
        latencyMs,
        consecutiveFailures: 0,
        lastChecked: new Date().toISOString(),
      });
    } catch (error) {
      const failures = (existing?.consecutiveFailures ?? 0) + 1;
      const status: HealthStatus = {
        serverId: conn.serverId,
        serverName: conn.serverName,
        status: failures >= this.failureThreshold ? "unreachable" : "degraded",
        latencyMs: null,
        consecutiveFailures: failures,
        lastChecked: new Date().toISOString(),
      };
      this.statuses.set(conn.serverId, status);

      if (failures === this.failureThreshold) {
        this.alertEngine
          .fireServerError(this.tenantId, {
            serverId: conn.serverId,
            serverName: conn.serverName,
            errorMessage: error instanceof Error ? error.message : "Health check failed",
            errorType: "health_check_failure",
          })
          .catch((err) =>
            console.error("[health] Failed to fire server error alert:", err)
          );
      }
    }
  }
}
