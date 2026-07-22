"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { Footer } from "@/components/layout/Footer";
import { Shield, ShieldCheck, Copy, Check, CheckCircle } from "lucide-react";

function SetupTwoFactorContent() {
  const { user, isAuthenticated, isLoading, twoFactorEnabled, setupTwoFactor, confirmTwoFactor } = useAuth();
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

  if (isLoading || !isAuthenticated || (twoFactorEnabled && step !== "backup")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-navy to-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal/30 border-t-teal" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-900 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-teal/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-teal/70 shadow-lg shadow-teal/25">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Secure your account</h1>
            <p className="mt-1 text-sm text-white/50">
              {step === "qr" && "Add an extra layer of protection to your account (optional, recommended)."}
              {step === "backup" && "Save your backup codes before continuing."}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          {step === "qr" && (
            <form onSubmit={handleConfirm} className="space-y-5">
              <p className="text-xs text-white/40">
                Scan this QR code with Google Authenticator, Microsoft Authenticator, Authy, or 2FAS, or enter the key manually.
              </p>
              {qrCode && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCode} alt="2FA QR code" className="mx-auto h-40 w-40 rounded-lg bg-white p-2" />
              )}
              <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
                <p className="min-w-0 flex-1 break-all font-mono text-xs text-white/60">{secret}</p>
                <button
                  type="button"
                  onClick={copySecret}
                  aria-label="Copy secret key"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
                >
                  {secretCopied ? <Check className="h-3.5 w-3.5 text-teal" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div>
                <label htmlFor="code" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Verification Code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-widest text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, x: [0, -8, 8, -6, 6, -2, 2, 0] }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400"
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={busy || !code}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
                className="w-full text-center text-sm text-white/50 hover:text-white/80 transition-colors"
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
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal/10"
              >
                <CheckCircle className="h-7 w-7 text-teal" />
              </motion.div>
              <p className="text-center text-sm text-white/70">
                Two-factor authentication is enabled. Save these one-time backup codes somewhere safe — each can be used once if you lose access to your authenticator app. They won&apos;t be shown again.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/5 p-3 font-mono text-sm text-white">
                {backupCodes.map((c) => <span key={c}>{c}</span>)}
              </div>
              <button
                type="button"
                onClick={copyBackupCodes}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-white/10"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy codes"}
              </button>
              <button
                type="button"
                onClick={goToDashboard}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70"
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
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-navy to-slate-800">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal/30 border-t-teal" />
        </div>
      }
    >
      <SetupTwoFactorContent />
    </Suspense>
  );
}
