"use client";

import { useEffect, useState } from "react";
import { api, TWO_FA_REVERIFY_EVENT } from "@/lib/api";
import { AnimatedCodeVerification } from "./AnimatedCodeVerification";

/**
 * Full-screen blocker shown when a sensitive action (export, backup/restore,
 * profile/security changes, password/UID changes) is rejected by the backend
 * with code 2FA_REVERIFICATION_REQUIRED because the account's last TOTP
 * verification is older than the 12h window (see requireRecent2FA on the
 * backend). Re-verifying here refreshes the tfaVerifiedAt claim on the
 * session tokens; the user can then retry whatever action was blocked.
 */
export function TwoFactorReverifyDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(TWO_FA_REVERIFY_EVENT, handler);
    return () => window.removeEventListener(TWO_FA_REVERIFY_EVENT, handler);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-popup-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-label="Two-factor re-verification required"
    >
      <AnimatedCodeVerification
        length={6}
        title="Verify it's you"
        subtitle="For your security, re-enter your two-factor code to continue"
        successTitle="Verified!"
        successSubtitle="You can continue where you left off"
        allowBackupCode
        onVerify={async (code) => { await api.post("/api/auth/2fa/reverify", { code }); }}
        onSuccess={() => setOpen(false)}
      />
    </div>
  );
}
