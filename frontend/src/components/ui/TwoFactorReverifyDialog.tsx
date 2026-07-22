"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "./Button";
import { api, ApiClientError, TWO_FA_REVERIFY_EVENT } from "@/lib/api";

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
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setError("");
      setCode("");
    };
    window.addEventListener(TWO_FA_REVERIFY_EVENT, handler);
    return () => window.removeEventListener(TWO_FA_REVERIFY_EVENT, handler);
  }, []);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsPending(true);
    setError("");
    try {
      await api.post("/api/auth/2fa/reverify", { code: code.trim() });
      setOpen(false);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Verification failed");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label="Two-factor re-verification required"
    >
      <div className="w-full max-w-sm rounded-xl border border-teal/20 bg-white shadow-2xl dark:border-teal/30 dark:bg-navy-dark">
        <div className="flex items-start gap-3 border-b border-black/5 p-6 dark:border-white/10">
          <ShieldCheck className="h-6 w-6 shrink-0 text-teal" />
          <div>
            <h2 className="text-lg font-semibold text-navy dark:text-white">Verify it&apos;s you</h2>
            <p className="mt-1 text-sm text-navy/60 dark:text-white/60">
              For your security, please re-enter your two-factor code to continue with this action.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label htmlFor="reverify-code" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-navy/50 dark:text-white/50">
              Verification Code
            </label>
            <input
              id="reverify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
              autoFocus
              className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm text-navy outline-none transition-colors focus:border-teal dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>
          <Button type="submit" disabled={isPending || !code.trim()} className="w-full">
            {isPending ? "Verifying…" : "Verify"}
          </Button>
        </form>
      </div>
    </div>
  );
}
