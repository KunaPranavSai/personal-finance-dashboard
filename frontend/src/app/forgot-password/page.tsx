"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { KeyRound, ArrowLeft, Mail, Smartphone, FileKey, CheckCircle, AlertCircle, UserCircle2, Lock } from "lucide-react";

const inputBase =
  "w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/20 focus:shadow-[0_0_16px_rgba(168,85,247,0.25)]";

const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed";

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={typeof children === "string" ? children : "error"}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto", x: [0, -6, 6, -4, 4, 0] }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
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

  const subtitle =
    step === "uid" ? "Enter your User ID to begin"
    : step === "method" ? "Choose how you'd like to verify your identity"
    : step === "verify" ? codeHint
    : "Your password has been reset";

  return (
    <AuthPageShell icon={KeyRound} title="Reset Password" subtitle={subtitle} pulse={step !== "done"}>
      <AnimatePresence mode="wait">
        {step === "uid" && (
          <motion.form key="uid" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} onSubmit={handleUidSubmit} className="space-y-5">
            <div>
              <label htmlFor="uid" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                User ID
              </label>
              <div className="relative">
                <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  id="uid"
                  type="text"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="Enter your UID"
                  required
                  autoFocus
                  className={inputBase}
                />
              </div>
            </div>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending || !uid} className={primaryButton}>
              {isPending ? "Checking…" : "Continue"}
            </motion.button>
          </motion.form>
        )}

        {step === "method" && (
          <motion.div key="method" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} className="space-y-3">
            {availableMethods.length === 0 ? (
              <p className="text-center text-sm text-[#94A3B8]">
                No recovery methods are available for this account. Make sure your profile email is set, or contact support.
              </p>
            ) : (
              availableMethods.map((m) => (
                <motion.button
                  key={m.id}
                  type="button"
                  whileHover={{ y: -2 }}
                  onClick={() => handleMethodSelect(m.id)}
                  disabled={isPending}
                  className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-left transition-all hover:border-purple-400/50 hover:bg-purple-500/5 disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                    <m.icon className="h-5 w-5 text-purple-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{m.label}</p>
                    <p className="text-xs text-[#94A3B8]">{m.description}</p>
                  </div>
                </motion.button>
              ))
            )}
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <button type="button" onClick={() => { setStep("uid"); setError(""); }} className="w-full text-center text-xs text-white/40 transition-colors hover:text-white/60">
              Back
            </button>
          </motion.div>
        )}

        {step === "verify" && (
          <motion.form key="verify" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} onSubmit={handleReset} className="space-y-5">
            <div>
              <label htmlFor="code" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
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
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-widest text-white placeholder:text-white/30 outline-none transition-all focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/20 focus:shadow-[0_0_16px_rgba(168,85,247,0.25)]"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  required
                  className={inputBase}
                  toggleClassName="text-white/30 hover:text-white/60"
                />
              </div>
              <PasswordStrengthMeter password={newPassword} />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className={inputBase}
                  toggleClassName="text-white/30 hover:text-white/60"
                />
              </div>
            </div>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending || !code || !newPassword || !confirmPassword} className={primaryButton}>
              {isPending ? "Resetting…" : "Reset Password"}
            </motion.button>

            <button type="button" onClick={() => { setStep("method"); setCode(""); setError(""); }} className="w-full text-center text-xs text-white/40 transition-colors hover:text-white/60">
              Choose a different method
            </button>
          </motion.form>
        )}

        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.35 }} className="space-y-5 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative mx-auto flex h-14 w-14 items-center justify-center"
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-400/30 blur-xl"
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.5)]">
                <CheckCircle className="h-7 w-7 text-white" />
              </div>
            </motion.div>
            <p className="text-sm text-[#94A3B8]">Your password has been reset successfully. You can now sign in with your new password.</p>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" onClick={() => router.push("/login")} className={primaryButton}>
              Back to sign in
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {step !== "done" && step !== "method" && (
        <motion.button
          type="button"
          whileHover={{ x: -3 }}
          onClick={() => router.push("/login")}
          className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/60"
        >
          <ArrowLeft className="h-3 w-3" /> Back to sign in
        </motion.button>
      )}
    </AuthPageShell>
  );
}
