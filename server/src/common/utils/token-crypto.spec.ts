import { decryptSecret, encryptSecret } from "./token-crypto";

const VALID_KEY = "a".repeat(64); // 32 bytes hex

describe("token-crypto", () => {
  const originalKey = process.env.APP_ENCRYPTION_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.APP_ENCRYPTION_KEY;
    } else {
      process.env.APP_ENCRYPTION_KEY = originalKey;
    }
  });

  describe("encryptSecret / decryptSecret round-trip", () => {
    beforeEach(() => {
      process.env.APP_ENCRYPTION_KEY = VALID_KEY;
    });

    it("decrypts back to the original plaintext", () => {
      const encrypted = encryptSecret("super-secret-api-key");
      expect(decryptSecret(encrypted)).toBe("super-secret-api-key");
    });

    it("round-trips an empty string", () => {
      const encrypted = encryptSecret("");
      expect(decryptSecret(encrypted)).toBe("");
    });

    it("produces a different iv and ciphertext on every call for the same plaintext", () => {
      const a = encryptSecret("same-value");
      const b = encryptSecret("same-value");
      expect(a.iv).not.toBe(b.iv);
      expect(a.ciphertext).not.toBe(b.ciphertext);
      // Both still decrypt correctly despite differing bytes.
      expect(decryptSecret(a)).toBe("same-value");
      expect(decryptSecret(b)).toBe("same-value");
    });

    it("detects tampering with the ciphertext (GCM auth tag)", () => {
      const encrypted = encryptSecret("do-not-tamper");
      const tampered = {
        ...encrypted,
        ciphertext:
          encrypted.ciphertext.slice(0, -2) +
          (encrypted.ciphertext.slice(-2) === "00" ? "ff" : "00"),
      };
      expect(() => decryptSecret(tampered)).toThrow();
    });

    it("detects tampering with the auth tag", () => {
      const encrypted = encryptSecret("do-not-tamper");
      const tampered = {
        ...encrypted,
        authTag:
          encrypted.authTag.slice(0, -2) + (encrypted.authTag.slice(-2) === "00" ? "ff" : "00"),
      };
      expect(() => decryptSecret(tampered)).toThrow();
    });
  });

  describe("missing/invalid APP_ENCRYPTION_KEY", () => {
    it("throws when APP_ENCRYPTION_KEY is not set", () => {
      delete process.env.APP_ENCRYPTION_KEY;
      expect(() => encryptSecret("x")).toThrow("APP_ENCRYPTION_KEY is not set");
    });

    it("throws when APP_ENCRYPTION_KEY is not 32 bytes", () => {
      process.env.APP_ENCRYPTION_KEY = "abcd"; // 2 bytes
      expect(() => encryptSecret("x")).toThrow(
        "APP_ENCRYPTION_KEY must be 32 bytes (64 hex characters).",
      );
    });
  });
});
