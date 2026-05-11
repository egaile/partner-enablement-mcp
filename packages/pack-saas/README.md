# @mcpshield/pack-saas

SaaS / SOC2 baseline industry pack for [MCPShield](../../README.md). Ships in the open-source core as the reference pack — copy this when building your own.

## What it adds

- **Policy templates:** Audit Everything (log-only baseline), Secrets Shield (redacts API keys).
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
