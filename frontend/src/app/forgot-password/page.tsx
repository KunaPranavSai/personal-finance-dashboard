"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { Footer } from "@/components/layout/Footer";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Shield, KeyRound, ArrowLeft, Mail, Smartphone, FileKey, CheckCircle } from "lucide-react";

function ShakeError({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={typeof children === "string" ? children : "error"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, x: [0, -8, 8, -6, 6, -2, 2, 0] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400"
      >
        <Shield className="h-4 w-4 shrink-0" />
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

type Method = "email" | "totp" | "backup";

interface RecoveryOptions {
  email: boolean;
  totp: boolean;
  backup: boolean;
}

const METHOD_META: { id: Method; label: string; description: string; icon: typeof Mail }[] = [
  { id: "email", label: "Email OTP", description: "Receive a 6-digit code at your registered email", icon: Mail },
  { id: "totp", label: "Authenticator App", description: "Use the 6-digit code from your authenticator app", icon: Smartphone },
  { id: "backup", label: "Backup Code", description: "Use one of your saved one-time backup codes", icon: FileKey },
];

export default function ForgotPasswordPage() {
  const { requestPasswordReset, confirmPasswordReset, getRecoveryOptions } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"uid" | "method" | "verify" | "done">("uid");
  const [uid, setUid] = useState("");
  const [options, setOptions] = useState<RecoveryOptions | null>(null);
  const [method, setMethod] = useState<Method>("email");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleUidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(true);
    try {
      const opts = (await getRecoveryOptions(uid.trim())) as RecoveryOptions;
      setOptions(opts);
      setStep("method");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsPending(false);
    }
  };

  const handleMethodSelect = async (m: Method) => {
    setError("");
    setMethod(m);
    if (m === "email") {
      setIsPending(true);
      try {
        await requestPasswordReset(uid.trim());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send code");
        setIsPending(false);
        return;
      }
      setIsPending(false);
    }
    setStep("verify");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setIsPending(true);
    try {
      await confirmPasswordReset(uid.trim(), code.trim(), newPassword, method);
      setStep("done");
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsPending(false);
    }
  };

  const availableMethods = METHOD_META.filter((m) => options?.[m.id]);

  const codeHint =
    method === "email"
      ? "Enter the 6-digit code we emailed you"
      : method === "totp"
      ? "Enter the 6-digit code from your authenticator app"
      : "Enter one of your one-time backup codes";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-900 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-teal/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-teal/70 shadow-lg shadow-teal/25">
            <KeyRound className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reset your password</h1>
            <p className="mt-1 text-sm text-white/50">
              {step === "uid" && "Enter your User ID to begin"}
              {step === "method" && "Choose how you'd like to verify your identity"}
              {step === "verify" && codeHint}
              {step === "done" && "Your password has been reset"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          {step === "uid" && (
            <form onSubmit={handleUidSubmit} className="space-y-5">
              <div>
                <label htmlFor="uid" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  User ID
                </label>
                <input
                  id="uid"
                  type="text"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="Enter your UID"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                />
              </div>

              {error && <ShakeError>{error}</ShakeError>}

              <button
                type="submit"
                disabled={isPending || !uid}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Checking…" : "Continue"}
              </button>
            </form>
          )}

          {step === "method" && (
            <div className="space-y-3">
              {availableMethods.length === 0 ? (
                <p className="text-center text-sm text-white/60">
                  No recovery methods are available for this account. Make sure your profile email is set, or contact support.
                </p>
              ) : (
                availableMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleMethodSelect(m.id)}
                    disabled={isPending}
                    className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-left transition-all hover:border-teal/50 hover:bg-teal/5 disabled:opacity-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal/10">
                      <m.icon className="h-5 w-5 text-teal" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{m.label}</p>
                      <p className="text-xs text-white/50">{m.description}</p>
                    </div>
                  </button>
                ))
              )}
              {error && <ShakeError>{error}</ShakeError>}
              <button
                type="button"
                onClick={() => { setStep("uid"); setError(""); }}
                className="w-full text-center text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Back
              </button>
            </div>
          )}

          {step === "verify" && (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label htmlFor="code" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  {method === "backup" ? "Backup Code" : "Verification Code"}
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode={method === "backup" ? "text" : "numeric"}
                  autoComplete={method === "backup" ? "off" : "one-time-code"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={method === "backup" ? "backup code" : "123456"}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-widest text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  New Password
                </label>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                  toggleClassName="text-white/30 hover:text-white/60"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Confirm New Password
                </label>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                  toggleClassName="text-white/30 hover:text-white/60"
                />
              </div>

              {error && <ShakeError>{error}</ShakeError>}

              <button
                type="submit"
                disabled={isPending || !code || !newPassword || !confirmPassword}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Resetting…" : "Reset Password"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("method"); setCode(""); setError(""); }}
                className="w-full text-center text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Choose a different method
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-5 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal/10"
              >
                <CheckCircle className="h-8 w-8 text-teal" />
              </motion.div>
              <p className="text-sm text-white/70">Your password has been reset successfully. You can now sign in with your new password.</p>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70"
              >
                Back to sign in
              </button>
            </div>
          )}

          {step !== "done" && step !== "method" && (
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </button>
          )}
        </div>
        <Footer variant="dark" />
      </div>
    </div>
  );
}
