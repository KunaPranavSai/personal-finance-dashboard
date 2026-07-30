"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, POST_LOGIN_REDIRECT_KEY } from "@/lib/AuthContext";
import { Footer } from "@/components/layout/Footer";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { AnimatedCheckbox } from "@/components/ui/AnimatedCheckbox";
import { AnimatedCodeVerification } from "@/components/ui/AnimatedCodeVerification";
import { ShieldCheck, Lock, Fingerprint, UserCircle2, AlertCircle } from "lucide-react";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { PREFER_BIOMETRIC_KEY } from "@/lib/passkeyPrefs";

const REMEMBERED_UID_KEY = "pfd-remembered-uid";

const inputBase =
  "w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/20 focus:shadow-[0_0_16px_rgba(168,85,247,0.25)]";

const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";

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

export default function LoginPage() {
  const { user, login, loginWithPasskey, verifyLogin2FA, forceChangePassword, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
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
    const remembered = localStorage.getItem(REMEMBERED_UID_KEY);
    if (remembered) {
      setUid(remembered);
      setRememberMe(true);
    } else {
      setRememberMe(false);
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
      try {
        if (rememberMe) localStorage.setItem(REMEMBERED_UID_KEY, uid.trim());
        else localStorage.removeItem(REMEMBERED_UID_KEY);
      } catch {
        // ignore storage failures (private browsing, etc.)
      }
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
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-400/30 border-t-purple-400" />
      </div>
    );
  }

  if (challengeToken) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0F19] p-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/20 blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-purple-600/20 blur-[100px]" />
        </div>
        <AnimatedCodeVerification
          length={6}
          title="Verify Your Identity"
          subtitle="Enter the 6-digit code from your authenticator app"
          successTitle="Signed In Successfully!"
          successSubtitle="Redirecting to your dashboard…"
          allowBackupCode
          onVerify={async (code) => { await verifyLogin2FA(challengeToken, code); }}
          onCancel={() => setChallengeToken(null)}
          cancelLabel="Back to sign in"
        />
      </div>
    );
  }

  if (passwordChangeToken) {
    return (
      <AuthPageShell icon={Lock} title="Create a new password" subtitle="You're using a temporary password — set a permanent one to continue">
        <form onSubmit={handleForceChangePassword} className="space-y-5">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters, letter + number"
              required
              autoFocus
              className={inputBase}
              toggleClassName="text-white/30 hover:text-white/60"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <PasswordInput
              id="confirmNewPassword"
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
              className={inputBase}
              toggleClassName="text-white/30 hover:text-white/60"
            />
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending || !newPassword || !confirmNewPassword} className={primaryButton}>
            {isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Lock className="h-4 w-4" />}
            {isPending ? "Saving…" : "Set New Password"}
          </motion.button>
        </form>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      icon={ShieldCheck}
      title="Welcome Back"
      subtitle="Access your account to continue"
      footer={<Footer variant="dark" />}
    >
      <AnimatePresence mode="wait">
        {mode === "biometric" ? (
          <motion.div key="biometric" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }} className="space-y-5">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="relative flex h-14 w-14 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-lg" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <Fingerprint className="h-7 w-7 text-purple-300" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Sign in with biometrics</p>
                <p className="mt-1 text-xs text-[#94A3B8]">Use Windows Hello, Touch ID, Face ID, or a security key registered on this account.</p>
              </div>
            </div>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" onClick={handleBiometricLogin} disabled={biometricPending} className={primaryButton}>
              {biometricPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Fingerprint className="h-4 w-4" />}
              {biometricPending ? "Waiting for biometrics…" : "Continue with Biometrics"}
            </motion.button>

            <button type="button" onClick={() => { setMode("password"); setError(""); }} className="w-full text-center text-xs text-white/40 transition-colors hover:text-white/60">
              Continue with Password
            </button>
          </motion.div>
        ) : (
          <motion.form key="password" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} onSubmit={handleSubmit} className="space-y-5">
            {webAuthnSupported && (
              <button
                type="button"
                onClick={() => { setMode("biometric"); setError(""); }}
                className="mb-1 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/10"
              >
                <Fingerprint className="h-4 w-4 text-purple-300" />
                Continue with Biometrics
              </button>
            )}

            <div>
              <label htmlFor="uid" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                User ID
              </label>
              <div className="relative">
                <UserCircle2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  id="uid"
                  type="text"
                  autoComplete="username"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="Enter your UID"
                  required
                  className={inputBase}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={inputBase}
                  toggleClassName="text-white/30 hover:text-white/60"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <AnimatedCheckbox id="remember-me" checked={rememberMe} onChange={setRememberMe} label="Remember me" />
                <Link href="/forgot-password" className="text-xs text-purple-300 transition-colors hover:text-purple-200 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending || !uid || !password} className={primaryButton}>
              {isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Lock className="h-4 w-4" />}
              {isPending ? "Signing in…" : "Sign In"}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/30">
        <ShieldCheck className="h-3 w-3" />
        <span>Secured with JWT authentication</span>
      </div>

      <p className="mt-4 text-center text-xs text-white/40">
        New here?{" "}
        <Link href="/signup" className="font-medium text-purple-300 transition-colors hover:text-purple-200">
          Create an account
        </Link>
      </p>
    </AuthPageShell>
  );
}
