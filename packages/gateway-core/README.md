# @mcpshield/gateway-core

The open-source core of [MCPShield](../../README.md) — a security and governance proxy for the Model Context Protocol.

## What's in here

- **Proxy engine** — transparent MCP proxy that intercepts every `tools/list` and `tools/call` request
- **Scanner pipeline** — prompt injection, unicode obfuscation, structural injection, exfiltration, secrets
- **Policy engine** — glob-matched rules (allow / deny / require_approval / log_only) with priority + time windows
- **PII scanner** — registry-backed; industry packs contribute additional patterns
- **Drift detection** — SHA-256 tool snapshots; alerts on schema changes
- **Audit logger** — pluggable storage (SQLite default)
- **Rate limiter** — in-memory sliding window
- **Webhook dispatcher** — HMAC-signed delivery
- **OAuth 2.1 client** — for downstream MCP servers (via `@modelcontextprotocol/sdk`)
- **Config-as-code** — define servers, policies, and packs in `mcpshield.yaml`

## License

MIT — see [`../../LICENSE`](../../LICENSE).
