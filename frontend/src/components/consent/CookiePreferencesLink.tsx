"use client";

import { useCookieConsent } from "./CookieConsentContext";

/** Reopens the Privacy Preference Center — used in footers so a visitor can
 * change their choice anytime after the first-visit notice is gone. */
export function CookiePreferencesLink({ className }: { className?: string }) {
  const { openPreferenceCenter } = useCookieConsent();
  return (
    <button type="button" onClick={openPreferenceCenter} className={className}>
      Cookie Preferences
    </button>
  );
}
