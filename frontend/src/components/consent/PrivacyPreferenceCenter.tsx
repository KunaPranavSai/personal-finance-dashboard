"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { useCookieConsent } from "./CookieConsentContext";

/**
 * What's actually gated here (see /cookie-notice and lib/cookieConsent.ts):
 * - ESSENTIAL: the `access_token`/`refresh_token` sign-in cookies (HTTP-only,
 *   set by the backend), this consent choice itself, and core app storage
 *   (storage-mode choice, session/device bookkeeping) — always on.
 * - FUNCTIONAL: two real, non-essential localStorage preferences —
 *   light/dark theme (`pfd-theme`) and a remembered sign-in email
 *   (`pfd-remembered-email`). The app works without these; they just won't
 *   be remembered across visits.
 *
 * Penny Pilot has no analytics/performance tracking and no marketing or
 * advertising tracking today, so those categories are explained, not
 * offered as toggles — see PENNY_PILOT_USER_MANUAL / Privacy Policy §8-9.
 */
export function PrivacyPreferenceCenter() {
  const { isPreferenceCenterOpen, closePreferenceCenter, consent, acceptAll, acceptEssentialOnly, savePreferences } =
    useCookieConsent();
  const [functionalDraft, setFunctionalDraft] = useState(consent?.functional ?? false);

  useEffect(() => {
    if (isPreferenceCenterOpen) setFunctionalDraft(consent?.functional ?? false);
  }, [isPreferenceCenterOpen, consent]);

  useEffect(() => {
    if (!isPreferenceCenterOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreferenceCenter();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isPreferenceCenterOpen, closePreferenceCenter]);

  if (!isPreferenceCenterOpen) return null;

  return (
        <motion.div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePreferenceCenter();
          }}
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-pp-border bg-pp-surface shadow-pp sm:max-w-lg sm:rounded-pp"
          >
            <FocusTrap active={isPreferenceCenterOpen}>
              <div role="dialog" aria-modal="true" aria-labelledby="ppc-title" className="flex max-h-[90vh] flex-col">
                <div className="flex items-start justify-between gap-3 border-b border-pp-border px-5 py-4 [padding-top:max(1rem,env(safe-area-inset-top))]">
                  <div>
                    <h2 id="ppc-title" className="text-lg font-bold text-pp-text">
                      Privacy Preference Center
                    </h2>
                    <p className="mt-1 text-sm text-pp-text-dim">
                      Penny Pilot uses cookies and local storage to provide essential functionality and, where you
                      allow it, to remember a few optional preferences. You can choose which optional category to
                      allow below.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closePreferenceCenter}
                    aria-label="Close Privacy Preference Center"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-pp-text-dim transition-colors hover:bg-pp-surface-2 hover:text-pp-text"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <section className="rounded-lg border border-pp-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-pp-accent" aria-hidden="true" />
                        <h3 className="text-sm font-semibold text-pp-text">Essential</h3>
                      </div>
                      <span className="rounded-full bg-pp-accent/10 px-2.5 py-1 text-xs font-medium text-pp-accent">
                        Always Active
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-pp-text-dim">
                      Required for signing in and keeping your session secure (the <code>access_token</code> and{" "}
                      <code>refresh_token</code> cookies), for remembering your storage-mode choice, and for storing
                      this consent preference itself. Penny Pilot cannot function without these.
                    </p>
                    <label className="mt-3 flex min-h-[44px] items-center gap-3">
                      <span
                        role="switch"
                        aria-checked="true"
                        aria-disabled="true"
                        aria-label="Essential — always active, cannot be disabled"
                        className="relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed items-center rounded-full bg-pp-accent opacity-60"
                      >
                        <span className="inline-block h-4 w-4 translate-x-6 rounded-full bg-white transition-transform" />
                      </span>
                      <span className="text-sm text-pp-text-dim">Cannot be turned off</span>
                    </label>
                  </section>

                  <section className="rounded-lg border border-pp-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-pp-text">Functional</h3>
                    </div>
                    <p className="mt-2 text-sm text-pp-text-dim">
                      Remembers your light/dark theme choice and (if you use it) your remembered sign-in email
                      between visits. Penny Pilot works fully without this — these details just won&apos;t be
                      remembered on your next visit.
                    </p>
                    <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={functionalDraft}
                        aria-label="Functional cookies"
                        onClick={() => setFunctionalDraft((v) => !v)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          functionalDraft ? "bg-pp-accent" : "bg-pp-surface-2"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                            functionalDraft ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="text-sm text-pp-text-dim">{functionalDraft ? "Allowed" : "Not allowed"}</span>
                    </label>
                  </section>

                  <section className="rounded-lg border border-pp-border bg-pp-surface-2/60 p-4">
                    <h3 className="text-sm font-semibold text-pp-text">Performance and Marketing</h3>
                    <p className="mt-2 text-sm text-pp-text-dim">
                      Penny Pilot does not currently use analytics, performance-tracking, or marketing/advertising
                      cookies of any kind. If that ever changes, this section will offer real choices instead of
                      this notice.
                    </p>
                  </section>

                  <p className="text-xs text-pp-text-dim">
                    See the{" "}
                    <Link href="/cookie-notice" className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80">
                      Cookie Notice
                    </Link>{" "}
                    for full details, or the{" "}
                    <Link href="/privacy-policy" className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>

                <div className="flex flex-col gap-2 border-t border-pp-border px-5 py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={acceptEssentialOnly}
                    className="min-h-[44px] rounded-xl border border-pp-border px-4 py-2.5 text-sm font-semibold text-pp-text transition-colors hover:bg-pp-surface-2 sm:order-1"
                  >
                    Accept Essential
                  </button>
                  <button
                    type="button"
                    onClick={() => savePreferences(functionalDraft)}
                    className="min-h-[44px] rounded-xl border border-pp-border px-4 py-2.5 text-sm font-semibold text-pp-text transition-colors hover:bg-pp-surface-2 sm:order-2"
                  >
                    Save My Preferences
                  </button>
                  <button
                    type="button"
                    onClick={acceptAll}
                    className="min-h-[44px] rounded-xl bg-pp-accent px-4 py-2.5 text-sm font-semibold text-pp-accent-ink transition-opacity hover:opacity-90 sm:order-3"
                  >
                    Accept All Cookies
                  </button>
                </div>
              </div>
            </FocusTrap>
          </motion.div>
        </motion.div>
  );
}
