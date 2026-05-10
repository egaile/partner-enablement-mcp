export type {
  TenantContext,
  DownstreamConnection,
  InterceptResult,
} from "./types.js";
export {
  ConnectionManager,
  type ConnectionManagerOptions,
} from "./connection-manager.js";
export {
  ToolInterceptor,
  type ToolInterceptorOptions,
} from "./tool-interceptor.js";
export {
  HealthChecker,
  type HealthCheckerOptions,
  type HealthStatus,
} from "./health-checker.js";
export {
  GatewayProxyEngine,
  type GatewayProxyEngineOptions,
} from "./engine.js";
export {
  type AlertSink,
  type AuditRecorder,
  type BillingGuard,
  type OAuthProviderFactory,
  noopAlertSink,
  noopBillingGuard,
} from "./ports.js";
