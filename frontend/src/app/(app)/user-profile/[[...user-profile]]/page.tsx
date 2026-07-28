"use client";

import { UserProfile } from "@clerk/nextjs";

/**
 * Clerk's own hosted account page — password, MFA (TOTP/SMS), passkeys
 * (Windows Hello/Touch ID/Face ID/Android biometrics/security keys), and
 * connected accounts (Google, etc.) all come from Clerk's prebuilt UI, no
 * custom code needed. Linked from Settings -> Security when
 * NEXT_PUBLIC_AUTH_PROVIDER=clerk (see (app)/settings/page.tsx).
 */
export default function UserProfilePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4 dark:bg-navy-dark">
      <UserProfile />
    </div>
  );
}
