# @mcpshield/gateway-core

The open-source core of [MCPShield](../../README.md) — a security and governance proxy for the Model Context Protocol.

## What's in here

- **Proxy engine** — `GatewayProxyEngine`, transparent MCP proxy that intercepts every `tools/list` and `tools/call` request
- **Connection manager** — opens stdio + HTTP transports to downstream MCP servers; pluggable OAuth 2.1 via the SDK
- **Scanner pipeline** — prompt injection, unicode obfuscation, structural injection, exfiltration, secrets
- **Policy engine** — glob-matched rules (allow / deny / require_approval / log_only) with priority + time windows
- **PII scanner** — registry-backed; industry packs contribute additional patterns
- **Drift detector** — SHA-256 tool snapshots; flags critical / functional / cosmetic changes
- **Audit logger** — buffered batch writer over a pluggable `StorageBackend` (SQLite default)
- **Rate limiter** — in-memory sliding window keyed by tenant/user/server/tool
- **Health checker** — periodic `tools/list` ping with alert escalation
- **Config-as-code** — define servers, policies, and packs in `mcpshield.yaml`

## Cloud ports

Cloud-only concerns (alerts, billing, OAuth state persistence, multi-tenancy)
plug in via the small interfaces in `proxy/ports.ts` — `AlertSink`,
`BillingGuard`, `OAuthProviderFactory`, `AuditRecorder`. Self-host deployments
leave them undefined and run on safe defaults.

## License

MIT — see [`../../LICENSE`](../../LICENSE).
