import { describe, it, expect } from "vitest";
import { scanForPii, redactPii } from "../pii-scanner.js";

describe("PII Scanner", () => {
  describe("scanForPii", () => {
    it("detects SSN patterns", () => {
      const result = scanForPii({ ssn: "My SSN is 123-45-6789" });
      expect(result.detected).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].type).toBe("ssn");
    });

    it("detects credit card numbers", () => {
      const result = scanForPii({ card: "Card: 4111111111111111" });
      expect(result.detected).toBe(true);
      expect(result.matches.some((m) => m.type === "credit_card")).toBe(true);
    });

    it("rejects invalid credit card numbers via Luhn check", () => {
      const result = scanForPii({ card: "Card: 1234567890123456" });
      const ccMatches = result.matches.filter((m) => m.type === "credit_card");
      expect(ccMatches).toHaveLength(0);
    });

    it("detects email addresses", () => {
      const result = scanForPii({ email: "Contact john.doe@example.com" });
      expect(result.detected).toBe(true);
      expect(result.matches[0].type).toBe("email");
    });

    it("detects US phone numbers", () => {
      const result = scanForPii({ phone: "Call (555) 123-4567" });
      expect(result.detected).toBe(true);
      expect(result.matches.some((m) => m.type === "phone")).toBe(true);
    });

    it("detects IP addresses", () => {
      const result = scanForPii({ ip: "Server at 192.168.1.100" });
      expect(result.detected).toBe(true);
      expect(result.matches[0].type).toBe("ip_address");
    });

    it("detects date of birth patterns", () => {
      const result = scanForPii({ dob: "Born 01/15/1990" });
      expect(result.detected).toBe(true);
      expect(result.matches[0].type).toBe("date_of_birth");
    });

    it("detects medical record numbers", () => {
      const result = scanForPii({ mrn: "Patient MRN: 12345678" });
      expect(result.detected).toBe(true);
      expect(result.matches[0].type).toBe("medical_record");
    });

    it("scans nested objects recursively", () => {
      const result = scanForPii({
        patient: {
          info: {
            ssn: "SSN: 123-45-6789",
          },
        },
      });
      expect(result.detected).toBe(true);
      expect(result.matches[0].fieldPath).toBe("patient.info.ssn");
    });

    it("scans arrays", () => {
      const result = scanForPii({
        records: ["SSN: 123-45-6789", "Clean text"],
      });
      expect(result.detected).toBe(true);
      expect(result.matches[0].fieldPath).toBe("records[0]");
    });

    it("returns clean result for safe content", () => {
      const result = scanForPii({ text: "Hello world, nothing sensitive here" });
      expect(result.detected).toBe(false);
      expect(result.matches).toHaveLength(0);
    });

    it("detects multiple PII types in one field", () => {
      const result = scanForPii({
        data: "SSN 123-45-6789, email test@example.com",
      });
      expect(result.detected).toBe(true);
      expect(result.matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("redactPii", () => {
    it("redacts SSN", () => {
      expect(redactPii("SSN: 123-45-6789")).toBe("SSN: [REDACTED]");
    });

    it("redacts email", () => {
      expect(redactPii("email: john@example.com")).toBe("email: [REDACTED]");
    });

    it("redacts multiple types", () => {
      const result = redactPii("SSN 123-45-6789 email john@test.com");
      expect(result).not.toContain("123-45-6789");
      expect(result).not.toContain("john@test.com");
    });

    it("preserves non-PII text", () => {
      expect(redactPii("Hello world")).toBe("Hello world");
    });
  });
});
