"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Eye, EyeOff, TrendingUp, Shield, Lock } from "lucide-react";

export default function LoginPage() {
  const { login, verifyLogin2FA, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(true);
    try {
      const result = await login(uid.trim(), password);
      if (result.requires2FA && result.challengeToken) {
        setChallengeToken(result.challengeToken);
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsPending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    setError("");
    setIsPending(true);
    try {
      await verifyLogin2FA(challengeToken, code.trim());
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-navy to-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal/30 border-t-teal" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-900 p-4">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-teal/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-teal/70 shadow-lg shadow-teal/25">
            <TrendingUp className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Finance Dashboard Pro</h1>
            <p className="mt-1 text-sm text-white/50">Sign in to manage your finances</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          {challengeToken ? (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div>
                <label htmlFor="code" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Verification Code
                </label>
                <p className="mb-3 text-xs text-white/40">Enter the 6-digit code from your authenticator app, or a backup code.</p>
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
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                  <Shield className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || !code}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Verify
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setChallengeToken(null); setCode(""); setError(""); }}
                className="w-full text-center text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Back to sign in
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* UID */}
            <div>
              <label htmlFor="uid" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                User ID
              </label>
              <input
                id="uid"
                type="text"
                autoComplete="username"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder="Enter your UID"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                <Shield className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending || !uid || !password}
              className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Sign in
                </>
              )}
            </button>
          </form>
          )}

          {/* Security note */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/30">
            <Shield className="h-3 w-3" />
            <span>Secured with JWT authentication</span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-white/20">
          Personal Finance Dashboard Pro © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
