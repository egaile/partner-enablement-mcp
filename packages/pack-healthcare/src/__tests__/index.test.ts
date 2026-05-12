import { describe, it, expect } from "vitest";
import healthcare from "../index.js";

describe("@mcpshield/pack-healthcare", () => {
  describe("pack manifest", () => {
    it("exports a valid IndustryPack default", () => {
      expect(healthcare.id).toBe("healthcare");
      expect(healthcare.name).toMatch(/HIPAA/i);
      expect(healthcare.pii.length).toBeGreaterThan(0);
      expect(healthcare.policyTemplates.length).toBeGreaterThan(0);
      expect(healthcare.compliance[0].id).toBe("hipaa");
    });

    it("declares restricted classification on PHI patterns", () => {
      for (const p of healthcare.pii) {
        expect(p.classification).toBe("restricted");
      }
    });

    it("uses [PHI:*] redaction labels on every pattern", () => {
      for (const p of healthcare.pii) {
        expect(p.redactionLabel).toMatch(/^\[PHI:/);
      }
    });
  });

  describe("NPI validator", () => {
    function findNpi() {
      return healthcare.pii.find((p) => p.type === "npi")!;
    }

    it("accepts a valid NPI (1234567893)", () => {
      // 1234567893 is the CMS-published example NPI.
      expect(findNpi().validator!("1234567893")).toBe(true);
    });

    it("rejects an NPI with a wrong check digit", () => {
      // Same digits but the last one flipped — Luhn must reject.
      expect(findNpi().validator!("1234567890")).toBe(false);
    });

    it("rejects strings that are not 10 digits", () => {
      expect(findNpi().validator!("123456789")).toBe(false);
      expect(findNpi().validator!("12345678930")).toBe(false);
    });
  });

  describe("DEA validator", () => {
    function findDea() {
      return healthcare.pii.find((p) => p.type === "dea")!;
    }

    it("accepts a valid DEA (AB1234563)", () => {
      // (1+3+5) + 2*(2+4+6) = 9 + 24 = 33 → 3.
      expect(findDea().validator!("AB1234563")).toBe(true);
    });

    it("rejects a DEA with a wrong check digit", () => {
      expect(findDea().validator!("AB1234567")).toBe(false);
    });

    it("rejects strings that don't match the 2-letter+7-digit shape", () => {
      expect(findDea().validator!("ABC123456")).toBe(false);
      expect(findDea().validator!("AB12345")).toBe(false);
    });
  });

  describe("ICD-10 pattern", () => {
    function findIcd10() {
      return healthcare.pii.find((p) => p.type === "icd10")!;
    }

    it("matches common ICD-10 codes", () => {
      const haystack =
        "Patient diagnosed with E11.65 (type 2 diabetes w/ hyperglycemia) and J45.909.";
      const matches = haystack.match(findIcd10().pattern);
      expect(matches).toContain("E11.65");
      expect(matches).toContain("J45.909");
    });

    it("does not match plain English words", () => {
      // "U" is a valid ICD-10 first letter, but standalone words shouldn't trip
      // the regex unless they fit the digit pattern.
      const matches = "Today the patient feels fine.".match(
        findIcd10().pattern
      );
      expect(matches).toBeNull();
    });
  });

  describe("policy templates", () => {
    it("PHI Shield redacts PII via modifier", () => {
      const phi = healthcare.policyTemplates.find(
        (t) => t.id === "hipaa_phi_shield"
      )!;
      expect(phi.rules[0].modifiers?.redactPII).toBe(true);
      expect(phi.rules[0].action).toBe("allow");
    });

    it("'Approval for clinical writes' targets write-shaped tools", () => {
      const tpl = healthcare.policyTemplates.find(
        (t) => t.id === "hipaa_approval_for_writes"
      )!;
      expect(tpl.rules[0].action).toBe("require_approval");
      const tools = tpl.rules[0].conditions.tools!;
      expect(tools).toContain("*__edit*");
      expect(tools).toContain("*__delete*");
    });

    it("'Audit Everything' logs all tools", () => {
      const tpl = healthcare.policyTemplates.find(
        (t) => t.id === "hipaa_audit_everything"
      )!;
      expect(tpl.rules[0].action).toBe("log_only");
      expect(tpl.rules[0].conditions.tools).toEqual(["*"]);
    });
  });
});
