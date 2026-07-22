"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth, POST_LOGIN_REDIRECT_KEY } from "@/lib/AuthContext";
import { Footer } from "@/components/layout/Footer";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Shield, Lock, Fingerprint } from "lucide-react";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { PREFER_BIOMETRIC_KEY } from "@/lib/passkeyPrefs";

export default function LoginPage() {
  const { user, login, loginWithPasskey, verifyLogin2FA, forceChangePassword, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [passwordChangeToken, setPasswordChangeToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [mode, setMode] = useState<"password" | "biometric">("password");
  const [biometricPending, setBiometricPending] = useState(false);

  useEffect(() => {
    const supported = browserSupportsWebAuthn();
    setWebAuthnSupported(supported);
    if (supported && localStorage.getItem(PREFER_BIOMETRIC_KEY) === "1") {
      setMode("biometric");
    }
  }, []);

  const handleBiometricLogin = async () => {
    setError("");
    setBiometricPending(true);
    try {
      await loginWithPasskey();
      // The auth-state effect below redirects once `user` is populated.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Biometric sign-in failed");
    } finally {
      setBiometricPending(false);
    }
  };

  const resolveDestination = (role: string, justOnboarded?: boolean) => {
    if (typeof window !== "undefined") {
      const fromQuery = new URLSearchParams(window.location.search).get("redirect");
      const fromExpiry = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
      sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
      const preserved = fromQuery || fromExpiry;
      // Only ever redirect within our own app, and never back into an auth page.
      if (preserved && preserved.startsWith("/") && !preserved.startsWith("/login") && !preserved.startsWith("//")) {
        return preserved;
      }
    }
    const isUser = role === "USER";
    return isUser ? (justOnboarded ? "/dashboard?welcome=1" : "/dashboard") : "/admin";
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace(resolveDestination(user.role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(true);
    try {
      const result = await login(uid.trim(), password);
      if (result.requiresPasswordChange && result.passwordChangeToken) {
        setPasswordChangeToken(result.passwordChangeToken);
      } else if (result.requires2FA && result.challengeToken) {
        setChallengeToken(result.challengeToken);
      }
      // else: the auth-state effect above redirects once `user` is populated.
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
      // The auth-state effect above redirects once `user` is populated.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsPending(false);
    }
  };

  const handleForceChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordChangeToken) return;
    setError("");
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Password must be at least 8 characters and include a letter and a number");
      return;
    }
    setIsPending(true);
    try {
      const { justOnboarded, user: updatedUser } = await forceChangePassword(passwordChangeToken, newPassword);
      router.replace(resolveDestination(updatedUser?.role ?? "USER", justOnboarded));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set new password");
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
          <Image src="/logo.png" alt="Penny Pilot" width={64} height={64} className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-teal/25" />
          <div>
            <h1 className="text-2xl font-bold text-white">Penny Pilot</h1>
            <p className="mt-1 text-sm text-white/50">Sign in to manage your finances</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          {passwordChangeToken ? (
            <form onSubmit={handleForceChangePassword} className="space-y-5">
              <div>
                <p className="mb-1 text-sm font-semibold text-white">Create a new password</p>
                <p className="mb-4 text-xs text-white/40">You&apos;re using a temporary password. Set a permanent one to continue.</p>
                <label htmlFor="newPassword" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  New Password
                </label>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters, letter + number"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                  toggleClassName="text-white/30 hover:text-white/60"
                />
              </div>
              <div>
                <label htmlFor="confirmNewPassword" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Confirm Password
                </label>
                <PasswordInput
                  id="confirmNewPassword"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                  toggleClassName="text-white/30 hover:text-white/60"
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
                disabled={isPending || !newPassword || !confirmNewPassword}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Set New Password
                  </>
                )}
              </button>
            </form>
          ) : challengeToken ? (
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
          ) : mode === "biometric" ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/10">
                  <Fingerprint className="h-7 w-7 text-teal" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Sign in with biometrics</p>
                  <p className="mt-1 text-xs text-white/40">Use Windows Hello, Touch ID, Face ID, or a security key registered on this account.</p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                  <Shield className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometricPending}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {biometricPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Waiting for biometrics…
                  </>
                ) : (
                  <>
                    <Fingerprint className="h-4 w-4" />
                    Continue with Biometrics
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode("password"); setError(""); }}
                className="w-full text-center text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Continue with Password
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {webAuthnSupported && (
              <button
                type="button"
                onClick={() => { setMode("biometric"); setError(""); }}
                className="mb-1 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition-all hover:bg-white/10"
              >
                <Fingerprint className="h-4 w-4 text-teal" />
                Continue with Biometrics
              </button>
            )}

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
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                toggleClassName="text-white/30 hover:text-white/60"
              />
              <div className="mt-2 text-right">
                <Link href="/forgot-password" className="text-xs text-white/40 hover:text-white/60 transition-colors">
                  Forgot password?
                </Link>
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

          {!challengeToken && !passwordChangeToken && (
            <p className="mt-4 text-center text-xs text-white/40">
              New here?{" "}
              <Link href="/signup" className="font-medium text-teal hover:text-teal/80 transition-colors">
                Create an account
              </Link>
            </p>
          )}
        </div>

        <Footer variant="dark" />
      </div>
    </div>
  );
}
