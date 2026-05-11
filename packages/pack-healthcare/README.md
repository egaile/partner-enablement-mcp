# @mcpshield/pack-healthcare

HIPAA-aligned industry pack for [MCPShield](../../README.md).

## What it contributes

**PII patterns** (detected by the gateway scanner):

| Type | Pattern | Validator |
|---|---|---|
| `npi` | 10-digit National Provider Identifier | CMS Luhn-style checksum |
| `icd10` | ICD-10-CM diagnosis codes (e.g. `E11.65`) | — |
| `dea` | DEA registration numbers (e.g. `AB1234567`) | Position-weighted checksum |
| `medical_record` | `MRN: 12345678` | — (override of core MRN with `[PHI:MRN]` label) |

**Policy templates** (one-click setups in the admin UI / CLI):

- **PHI Shield** — allow every call, but redact PHI in inputs + responses.
- **HIPAA: Audit Everything** — log every tool call for §164.312(b) evidence.
- **HIPAA: Approval for clinical writes** — `require_approval` on `*__edit*`, `*__update*`, `*__delete*`, `*__transition*`, `*__create*`.

**Compliance** — maps to HIPAA.

## Install

```bash
npm install @mcpshield/pack-healthcare
```

Then add it to `mcpshield.yaml`:

```yaml
packs:
  - "@mcpshield/pack-healthcare"
```

Restart `mcpshield start` (or wait for hot-reload). The pack's PII patterns are registered into the gateway's runtime scanner; its policy templates become available to apply via the admin UI.

## License

MIT — see [`LICENSE`](LICENSE).
