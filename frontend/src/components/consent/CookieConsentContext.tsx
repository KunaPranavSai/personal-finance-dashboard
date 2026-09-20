"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCookieConsent, saveCookieConsent, hasCookieConsentChoice, type CookieConsentState } from "@/lib/cookieConsent";

interface CookieConsentContextValue {
  /** null until a choice has been made (fresh visitor / cleared storage). */
  consent: CookieConsentState | null;
  /** True once a valid stored choice exists — controls whether the bottom notice shows. */
  hasChoice: boolean;
  isPreferenceCenterOpen: boolean;
  openPreferenceCenter: () => void;
  closePreferenceCenter: () => void;
  acceptAll: () => void;
  acceptEssentialOnly: () => void;
  savePreferences: (functional: boolean) => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<CookieConsentState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isPreferenceCenterOpen, setPreferenceCenterOpen] = useState(false);

  useEffect(() => {
    setConsentState(getCookieConsent());
    setHydrated(true);
  }, []);

  const acceptAll = useCallback(() => {
    setConsentState(saveCookieConsent(true));
    setPreferenceCenterOpen(false);
  }, []);

  const acceptEssentialOnly = useCallback(() => {
    setConsentState(saveCookieConsent(false));
    setPreferenceCenterOpen(false);
  }, []);

  const savePreferences = useCallback((functional: boolean) => {
    setConsentState(saveCookieConsent(functional));
    setPreferenceCenterOpen(false);
  }, []);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      // Before hydration we don't yet know the real answer — treat as "has a
      // choice" so the banner never flashes on the server-rendered/first paint.
      hasChoice: hydrated ? consent !== null : true,
      isPreferenceCenterOpen,
      openPreferenceCenter: () => setPreferenceCenterOpen(true),
      closePreferenceCenter: () => setPreferenceCenterOpen(false),
      acceptAll,
      acceptEssentialOnly,
      savePreferences,
    }),
    [consent, hydrated, isPreferenceCenterOpen, acceptAll, acceptEssentialOnly, savePreferences]
  );

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    // Safe no-op fallback (e.g. a stray render outside the provider during
    // tests) — never throws, matching the pattern used elsewhere in the app.
    return {
      consent: null,
      hasChoice: hasCookieConsentChoice(),
      isPreferenceCenterOpen: false,
      openPreferenceCenter: () => {},
      closePreferenceCenter: () => {},
      acceptAll: () => {},
      acceptEssentialOnly: () => {},
      savePreferences: () => {},
    };
  }
  return ctx;
}
