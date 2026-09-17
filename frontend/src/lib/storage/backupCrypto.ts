// Password-based encryption for local backup exports (Master Plan §8:
// "where practical, make exported backups encrypted"). Uses the browser's
// native WebCrypto: PBKDF2 (150k iterations, SHA-256) to derive an AES-GCM
// key from the user's password, and AES-256-GCM for authenticated
// encryption. Nothing here is sent anywhere — it all runs locally, matching
// "This Device Only" mode's own no-server-round-trip principle.

export interface EncryptedBackupEnvelope {
  encrypted: true;
  app: "penny-pilot";
  version: 1;
  // All three are base64 — safe to embed directly in the downloaded JSON file.
  salt: string;
  iv: string;
  ciphertext: string;
}

const PBKDF2_ITERATIONS = 150_000;

function bufToBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function isEncryptedBackupEnvelope(value: unknown): value is EncryptedBackupEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { encrypted?: unknown }).encrypted === true &&
    typeof (value as { salt?: unknown }).salt === "string" &&
    typeof (value as { iv?: unknown }).iv === "string" &&
    typeof (value as { ciphertext?: unknown }).ciphertext === "string"
  );
}

export async function encryptBackupText(plaintext: string, password: string): Promise<EncryptedBackupEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, new TextEncoder().encode(plaintext));
  return {
    encrypted: true,
    app: "penny-pilot",
    version: 1,
    salt: bufToBase64(salt.buffer),
    iv: bufToBase64(iv.buffer),
    ciphertext: bufToBase64(ciphertext),
  };
}

/** Throws if the password is wrong or the file is corrupted — AES-GCM's
 * built-in authentication tag makes tampered/mismatched-password ciphertext
 * fail to decrypt rather than silently producing garbage. */
export async function decryptBackupText(envelope: EncryptedBackupEnvelope, password: string): Promise<string> {
  const salt = new Uint8Array(base64ToBuf(envelope.salt));
  const iv = new Uint8Array(base64ToBuf(envelope.iv));
  const key = await deriveKey(password, salt);
  const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, base64ToBuf(envelope.ciphertext));
  return new TextDecoder().decode(plaintextBuf);
}
