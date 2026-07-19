"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Footer } from "@/components/layout/Footer";
import { Shield, KeyRound, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const { requestPasswordReset, confirmPasswordReset } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [uid, setUid] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(true);
    try {
      await requestPasswordReset(uid.trim());
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request reset code");
    } finally {
      setIsPending(false);
    }
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
      await confirmPasswordReset(uid.trim(), code.trim(), newPassword);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsPending(false);
    }
  };

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
              {step === "request" && "Enter your User ID to receive a reset code"}
              {step === "reset" && "Enter the code we emailed you and a new password"}
              {step === "done" && "Your password has been reset"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          {step === "request" && (
            <form onSubmit={handleRequest} className="space-y-5">
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

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                  <Shield className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || !uid}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? "Sending…" : "Send reset code"}
              </button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label htmlFor="code" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Reset Code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg tracking-widest text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                  <Shield className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || !code || !newPassword || !confirmPassword}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? "Resetting…" : "Reset Password"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-5 text-center">
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

          {step !== "done" && (
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
