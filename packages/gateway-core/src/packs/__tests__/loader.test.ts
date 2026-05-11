import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadPacks } from "../loader.js";
import {
  listPiiPatterns,
  resetPiiRegistry,
  scanForPii,
} from "../../security/pii-scanner.js";

describe("loadPacks", () => {
  beforeEach(() => {
    resetPiiRegistry();
  });

  afterEach(() => {
    resetPiiRegistry();
  });

  it("returns an empty result when given no packs", async () => {
    const r = await loadPacks([]);
    expect(r.loaded).toEqual([]);
    expect(r.failed).toEqual([]);
  });

  it("captures errors from packs that can't be imported", async () => {
    const r = await loadPacks(["@mcpshield/pack-does-not-exist"]);
    expect(r.loaded).toHaveLength(0);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].source).toBe("@mcpshield/pack-does-not-exist");
    expect(r.failed[0].reason).toMatch(
      /cannot find|not found|module_not_found|failed to load/i
    );
  });

  it("loads a real pack and registers its PII patterns into the scanner", async () => {
    // pack-healthcare is part of the workspace; this exercises the full
    // dynamic-import + registerPiiPattern wiring.
    const r = await loadPacks(["@mcpshield/pack-healthcare"]);
    expect(r.failed).toEqual([]);
    expect(r.loaded).toHaveLength(1);
    expect(r.loaded[0].pack.id).toBe("healthcare");
    expect(r.loaded[0].pack.pii.length).toBeGreaterThan(0);

    // Patterns from the pack should now be visible in the scanner registry.
    const types = listPiiPatterns().map((p) => p.type);
    expect(types).toContain("npi");
    expect(types).toContain("dea");
    expect(types).toContain("icd10");

    // The scanner should detect a valid NPI thanks to the registered validator.
    // 1234567893 is the CMS-published example NPI (passes Luhn).
    const result = scanForPii({ note: "Doctor NPI: 1234567893" });
    const npiHit = result.matches.find((m) => m.type === "npi");
    expect(npiHit).toBeDefined();
  });

  it("rejects a module whose default export is not an IndustryPack", async () => {
    // Pick any installed module whose default export does NOT match our shape.
    // Using js-yaml — it has a default export but is not a pack.
    const r = await loadPacks(["js-yaml"]);
    expect(r.loaded).toHaveLength(0);
    expect(r.failed[0].reason).toMatch(/not a valid IndustryPack/);
  });

  it("a single broken pack does not prevent good packs from loading", async () => {
    const r = await loadPacks([
      "@mcpshield/pack-does-not-exist",
      "@mcpshield/pack-healthcare",
    ]);
    expect(r.loaded).toHaveLength(1);
    expect(r.failed).toHaveLength(1);
    expect(r.loaded[0].pack.id).toBe("healthcare");
  });
});
