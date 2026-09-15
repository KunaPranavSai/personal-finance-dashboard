import crypto from "crypto";

/** Opaque, high-entropy recovery token handed to the client once. Only its
 * SHA-256 hash is ever persisted — the raw value never touches the
 * database, logs, or a URL. 256 bits of randomness makes a fast hash (vs.
 * bcrypt, which is for low-entropy secrets like passwords/OTP codes)
 * appropriate and standard here. */
export function generateRecoveryToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashRecoveryToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
