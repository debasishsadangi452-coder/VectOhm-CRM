import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM authenticated encryption for secrets stored at rest (e.g. the
// company GitHub token). The key lives only in APP_ENCRYPTION_KEY (a 32-byte
// hex string), never in the database -- so a DB dump alone can't reveal the
// plaintext. GCM's auth tag also detects tampering on decrypt.
//
// This is the codebase's first reversible-encryption need; everything else
// (auth refresh tokens) uses one-way hashing, which can't round-trip a value
// we later have to send back out to an external API.

export interface EncryptedSecret {
  ciphertext: string; // hex
  iv: string; // hex
  authTag: string; // hex
}

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the standard for GCM

function getKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "APP_ENCRYPTION_KEY is not set. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be 32 bytes (64 hex characters).");
  }
  return key;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(secret.iv, "hex"));
  decipher.setAuthTag(Buffer.from(secret.authTag, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
