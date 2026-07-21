import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.BACKUP_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("BACKUP_TOKEN_ENCRYPTION_KEY is not set (or too short) — cannot encrypt/decrypt backup tokens.");
  }
  // Derive a 32-byte key from whatever-length secret string is provided.
  return crypto.createHash("sha256").update(secret).digest();
}

/** Encrypts a string into a single base64 payload: iv + authTag + ciphertext. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/** Decrypts a payload produced by encryptSecret. */
export function decryptSecret(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function isEncryptionConfigured(): boolean {
  const secret = process.env.BACKUP_TOKEN_ENCRYPTION_KEY;
  return Boolean(secret && secret.length >= 32);
}
