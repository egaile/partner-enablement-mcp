# @mcpshield/pack-saas

SaaS / SOC2 baseline industry pack for [MCPShield](../../README.md). Ships in the open-source core as the reference pack. Copy this when building your own.

## What it adds

- **Policy templates:** Audit Everything (log-only baseline), Secrets Shield (sets the `redactSecrets` modifier, which gateway-core does not enforce yet, so this template has no effect today).
- **Compliance:** SOC 2.
- **PII:** none beyond core (email, phone, IP, SSN, credit card, DOB).
- **Default classification:** `internal`.

## Use

```yaml
# mcpshield.yaml
packs:
  - "@mcpshield/pack-saas"
```

## License

MIT
