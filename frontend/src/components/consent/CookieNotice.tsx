"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useCookieConsent } from "./CookieConsentContext";

/** Compact bottom notice shown only until a visitor makes a consent choice —
 * see PrivacyPreferenceCenter.tsx for what's actually gated. Plain
 * conditional rendering (no AnimatePresence exit) so dismissal is
 * immediate and reliable — only the entrance is animated. */
export function CookieNotice() {
  const { hasChoice, openPreferenceCenter, acceptAll, acceptEssentialOnly } = useCookieConsent();

  if (hasChoice) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-[190] px-4 pb-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-pp border border-pp-border bg-pp-surface p-4 shadow-pp sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="text-sm font-semibold text-pp-text">Cookies &amp; Privacy</p>
          <p className="mt-1 text-sm text-pp-text-dim">
            Penny Pilot uses essential cookies and similar storage to keep the service secure and working.
            Optional cookies are used only for the purposes described in the preference center.{" "}
            <Link href="/privacy-policy" className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80">
              Privacy Policy
            </Link>{" "}
            ·{" "}
            <Link href="/cookie-notice" className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80">
              Cookie Notice
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={openPreferenceCenter}
            className="min-h-[44px] rounded-xl border border-pp-border px-4 py-2 text-sm font-semibold text-pp-text transition-colors hover:bg-pp-surface-2"
          >
            Manage Preferences
          </button>
          <button
            type="button"
            onClick={acceptEssentialOnly}
            className="min-h-[44px] rounded-xl border border-pp-border px-4 py-2 text-sm font-semibold text-pp-text transition-colors hover:bg-pp-surface-2"
          >
            Accept Essential
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="min-h-[44px] rounded-xl bg-pp-accent px-4 py-2 text-sm font-semibold text-pp-accent-ink transition-opacity hover:opacity-90"
          >
            Accept All Cookies
          </button>
        </div>
      </div>
    </motion.div>
  );
}
