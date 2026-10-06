"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { Footer } from "@/components/layout/Footer";
import { Shield, ShieldCheck, Copy, Check, CheckCircle } from "lucide-react";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileSetup2FAView } from "@/components/mobile/MobileSetup2FAView";

function SetupTwoFactorContent() {
  const { user, isAuthenticated, isLoading, twoFactorEnabled, setupTwoFactor, confirmTwoFactor } = useAuth();
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";

  const [step, setStep] = useState<"loading" | "qr" | "backup">("loading");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  const goToDashboard = useCallback(() => {
    const target = user?.role === "USER" ? "/dashboard" : "/admin";
    router.replace(welcome ? `${target}?welcome=1` : target);
  }, [user, welcome, router]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    } else if (!isLoading && isAuthenticated && twoFactorEnabled && step !== "backup") {
      goToDashboard();
    }
  }, [isLoading, isAuthenticated, twoFactorEnabled, step, goToDashboard]);

  const startSetup = useCallback(async () => {
    setError("");
    try {
      const data = await setupTwoFactor();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("qr");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start 2FA setup");
    }
  }, [setupTwoFactor]);

  useEffect(() => {
    if (isAuthenticated && !twoFactorEnabled && step === "loading") {
      startSetup();
    }
  }, [isAuthenticated, twoFactorEnabled, step, startSetup]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await confirmTwoFactor(code.trim());
      setBackupCodes(data.backupCodes);
      setStep("backup");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  if (isMobile) return <MobileSetup2FAView />;

  if (isLoading || !isAuthenticated || (twoFactorEnabled && step !== "backup")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pp-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pp-accent/30 border-t-pp-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-pp-bg p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-pp-accent/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-pp-accent/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pp-accent to-pp-accent/70 shadow-lg shadow-pp-accent/25">
            <ShieldCheck className="h-8 w-8 text-pp-accent-ink" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-pp-text">Secure your account</h1>
            <p className="mt-1 text-sm text-pp-text-dim">
              {step === "qr" && "Add an extra layer of protection to your account (optional, recommended)."}
              {step === "backup" && "Save your backup codes before continuing."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-pp-border bg-pp-surface-2 backdrop-blur-xl p-8 shadow-2xl">
          {step === "loading" && (
            error ? (
              <div className="space-y-4 text-center">
                <p role="alert" className="rounded-lg bg-pp-critical/10 px-3 py-2 text-sm font-medium text-pp-critical">{error}</p>
                <button type="button" onClick={startSetup} className="w-full rounded-xl bg-pp-accent px-4 py-3 text-sm font-semibold text-pp-accent-ink transition hover:opacity-90">Try again</button>
              </div>
            ) : (
              <div className="flex justify-center py-6"><div className="h-8 w-8 animate-spin rounded-full border-4 border-pp-accent/30 border-t-pp-accent" role="status" aria-label="Preparing two-factor setup" /></div>
            )
          )}
          {step === "qr" && (
            <form onSubmit={handleConfirm} className="space-y-5">
              <p className="text-xs text-pp-text-dim">
                Scan this QR code with Google Authenticator, Microsoft Authenticator, Authy, or 2FAS, or enter the key manually.
              </p>
              {qrCode && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCode} alt="2FA QR code" className="mx-auto h-40 w-40 rounded-lg bg-white p-2" />
              )}
              <div className="flex items-center gap-2 rounded-lg bg-pp-surface-2 p-2">
                <p className="min-w-0 flex-1 break-all font-mono text-xs text-pp-text-dim">{secret}</p>
                <button
                  type="button"
                  onClick={copySecret}
                  aria-label="Copy secret key"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-pp-text-dim hover:bg-pp-chip-bg hover:text-pp-text"
                >
                  {secretCopied ? <Check className="h-3.5 w-3.5 text-pp-accent" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div>
                <label htmlFor="code" className="block text-xs font-semibold uppercase tracking-wider text-pp-text-dim mb-2">
                  Verification Code
                </label>
                <p id="code-hint" className="-mt-1 mb-2 text-xs text-pp-text-dim">Enter the 6 digits shown in your authenticator app.</p>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  maxLength={6}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "code-err" : "code-hint"}
                  placeholder="123456"
                  autoFocus
                  className="w-full rounded-xl border border-pp-border bg-pp-surface-2 px-4 py-3 text-center text-lg tracking-widest text-pp-text placeholder:text-pp-text-dim/70 focus:border-pp-accent/50 focus:outline-none focus:ring-2 focus:ring-pp-accent/25 transition-all"
                />
              </div>

              {error && (
                <motion.div
                  id="code-err"
                  role="alert"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, x: [0, -8, 8, -6, 6, -2, 2, 0] }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-2 rounded-lg bg-vulcanico/10 border border-vulcanico/20 px-3 py-2 text-sm text-pp-critical"
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full rounded-xl bg-pp-accent px-4 py-3 text-sm font-semibold text-pp-accent-ink shadow-pp transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-pp-border border-t-pp-accent" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" /> Verify & Enable
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={goToDashboard}
                className="w-full text-center text-sm text-pp-text-dim hover:text-pp-text transition-colors"
              >
                Skip for now
              </button>
            </form>
          )}

          {step === "backup" && (
            <div className="space-y-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pp-accent/10"
              >
                <CheckCircle className="h-7 w-7 text-pp-accent" />
              </motion.div>
              <p className="text-center text-sm text-pp-text-dim">
                Two-factor authentication is enabled. Save these one-time backup codes somewhere safe — each can be used once if you lose access to your authenticator app. They won&apos;t be shown again.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-pp-surface-2 p-3 font-mono text-sm text-pp-text">
                {backupCodes.map((c) => <span key={c}>{c}</span>)}
              </div>
              <button
                type="button"
                onClick={copyBackupCodes}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-pp-border bg-pp-surface-2 px-4 py-3 text-sm font-medium text-pp-text transition-all hover:bg-pp-chip-bg"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy codes"}
              </button>
              <button
                type="button"
                onClick={goToDashboard}
                className="w-full rounded-xl bg-pp-accent px-4 py-3 text-sm font-semibold text-pp-accent-ink shadow-pp transition hover:opacity-90 active:scale-[0.98]"
              >
                Continue to {user?.role === "USER" ? "Dashboard" : "Admin Dashboard"}
              </button>
            </div>
          )}
        </div>

        <Footer variant="dark" />
      </div>
    </div>
  );
}

export default function SetupTwoFactorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-pp-bg">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-pp-accent/30 border-t-pp-accent" />
        </div>
      }
    >
      <SetupTwoFactorContent />
    </Suspense>
  );
}
