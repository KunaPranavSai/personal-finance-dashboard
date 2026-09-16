/** Cryptographically strong, unpredictable key identifying one logical
 * user-initiated CREATE attempt — generate once per attempt and reuse the
 * same value across manual retries of that same attempt (never on a
 * genuinely new submission) so the backend can recognize a retried request
 * and avoid creating a duplicate record. */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
