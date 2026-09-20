/**
 * Cookie/local-storage consent — a single first-party, browser-only
 * preference record. This governs Penny Pilot's OWN non-essential local
 * storage (see components/consent/PrivacyPreferenceCenter.tsx and
 * /cookie-notice for what's actually gated and why); it is intentionally
 * separate from lib/consent.ts, which handles downloading the signed
 * Terms/Privacy Policy PDF recorded at signup — a legal e-signature, not a
 * cookie preference.
 *
 * Categories reflect what Penny Pilot actually does today (see the audit
 * notes in PrivacyPreferenceCenter.tsx) — `performance` and `marketing` are
 * kept in the shape for forward-compatibility but are not offered as real
 * toggles because Penny Pilot has no analytics or marketing tracking to
 * gate. Never add tracking just to make these fields meaningful.
 */
export interface CookieConsentState {
  /** Always true — authentication, security, and this consent record itself
   * cannot be declined. Not user-settable. */
  essential: true;
  /** Non-essential convenience preferences: remembering the light/dark theme
   * and a remembered sign-in email. The app fully functions without these —
   * they just won't be remembered across visits. */
  functional: boolean;
  /** Reserved: no analytics/performance tracking exists in Penny Pilot today. */
  performance: false;
  /** Reserved: no marketing/advertising tracking exists in Penny Pilot today. */
  marketing: false;
  /** Epoch ms when this choice was made. */
  timestamp: number;
  /** Bumped only if the categories/purposes described to the user change in
   * a way that requires re-prompting everyone (not for routine copy edits). */
  version: number;
}

export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_COOKIE_NAME = "pp_consent";
const CONSENT_MAX_AGE_DAYS = 365;

function isProd(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeDays: number): void {
  if (typeof document === "undefined") return;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  const secure = isProd() ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** Returns null when no valid consent choice has been made yet (fresh
 * visitor, cleared storage, or an unparseable/older-version record). */
export function getCookieConsent(): CookieConsentState | null {
  const raw = readCookie(COOKIE_CONSENT_COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsentState>;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    return {
      essential: true,
      functional: Boolean(parsed.functional),
      performance: false,
      marketing: false,
      timestamp: typeof parsed.timestamp === "number" ? parsed.timestamp : Date.now(),
      version: COOKIE_CONSENT_VERSION,
    };
  } catch {
    return null;
  }
}

export function hasCookieConsentChoice(): boolean {
  return getCookieConsent() !== null;
}

/** Persists a choice. Does not require a page reload — components read this
 * via CookieConsentContext, which re-renders immediately on change. */
export function saveCookieConsent(functional: boolean): CookieConsentState {
  const state: CookieConsentState = {
    essential: true,
    functional,
    performance: false,
    marketing: false,
    timestamp: Date.now(),
    version: COOKIE_CONSENT_VERSION,
  };
  writeCookie(COOKIE_CONSENT_COOKIE_NAME, JSON.stringify(state), CONSENT_MAX_AGE_DAYS);
  return state;
}

/** Clears the stored choice — the notice will reappear on next load. Used
 * only for testing/debugging; not exposed in the UI. */
export function clearCookieConsent(): void {
  deleteCookie(COOKIE_CONSENT_COOKIE_NAME);
}

/** Whether Penny Pilot's own non-essential preferences (theme, remembered
 * email) may be written to localStorage right now. */
export function hasFunctionalConsent(): boolean {
  return getCookieConsent()?.functional === true;
}
