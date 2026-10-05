// The daily PIN gate asks once per local calendar day; a PIN sign-in counts as that day's unlock.
export const pinToday = () => new Date().toLocaleDateString("en-CA");
const key = (userId: string) => `pp_pin_day_${userId}`;

export function readPinDay(userId: string): string | null {
  try { return localStorage.getItem(key(userId)); } catch { return null; }
}

export function markPinUnlockedToday(userId: string) {
  try { localStorage.setItem(key(userId), pinToday()); } catch { /* private mode: gate returns next load */ }
}

// Sign-in itself is required once per local calendar day on a device.
const loginKey = (userId: string) => `pp_login_day_${userId}`;

export function readLoginDay(userId: string): string | null {
  try { return localStorage.getItem(loginKey(userId)); } catch { return null; }
}

/** Call right after any successful sign-in: starts today's session and counts as today's PIN unlock. */
export function markLoggedInToday(userId: string) {
  try { localStorage.setItem(loginKey(userId), pinToday()); } catch { /* ignore */ }
  markPinUnlockedToday(userId);
}
