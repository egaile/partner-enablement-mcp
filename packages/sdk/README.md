# @mcpshield/sdk

Plugin SDK for building [MCPShield](../../README.md) industry packs.

A pack is a one-file npm module. It contributes PII patterns, policy templates, and compliance metadata to a running gateway.

## Install

```bash
npm install @mcpshield/sdk
```

## Define a pack

```ts
import { definePack } from "@mcpshield/sdk";

export default definePack({
  id: "healthcare",
  name: "Healthcare (HIPAA)",
  description: "PHI detection + HIPAA-aligned policy templates.",
  pii: [
    {
      type: "mrn",
      pattern: /\bMRN[:\s#-]*\d{4,12}\b/gi,
      redactionLabel: "[PHI:MRN]",
      classification: "restricted",
    },
  ],
  policyTemplates: [],
  compliance: [{ id: "hipaa", name: "HIPAA" }],
  defaultClassification: "confidential",
});
```

## Reference

- `definePack(pack)` — type-checks and returns the pack
- `IndustryPack` — full pack interface
- `PiiPatternDef` — PII pattern with validator + classification
- `PolicyTemplate` — one-click policy setup
- `DataClassification` — `'public' | 'internal' | 'confidential' | 'restricted'`

## License

MIT
