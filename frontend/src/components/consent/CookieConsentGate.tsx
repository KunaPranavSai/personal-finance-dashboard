"use client";

import { usePathname } from "next/navigation";
import { CookieNotice } from "./CookieNotice";
import { PrivacyPreferenceCenter } from "./PrivacyPreferenceCenter";

/** The Admin/Super Admin panel keeps its own separate visual identity and
 * isn't a public-visitor surface — never show the visitor-facing cookie
 * notice/preference center there. */
export function CookieConsentGate() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  if (isAdminRoute) return null;

  return (
    <>
      <CookieNotice />
      <PrivacyPreferenceCenter />
    </>
  );
}
