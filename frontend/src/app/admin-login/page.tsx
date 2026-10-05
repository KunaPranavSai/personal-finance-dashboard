"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { AnimatedCodeVerification } from "@/components/ui/AnimatedCodeVerification";
import { ShieldAlert, Lock, Mail, AlertCircle, ArrowLeft, KeyRound } from "lucide-react";
import { api } from "@/lib/api";

const inputBase =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30";

const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Dedicated administrator sign-in — deliberately distinct from the normal user /login page:
 * a flat, minimal "internal operations console" look (no gradients, no biometric option, no
 * signup link), rather than the consumer app's glassmorphic auth flow. Reuses the exact same
 * backend auth endpoints/session model as /login (via useAuth) — this is a different door into
 * the same authentication system, not a separate one.
 */
export default function AdminLoginPage() {
  const { user, login, loginWithPin, verifyLogin2FA, forceChangePassword, logout, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [passwordChangeToken, setPasswordChangeToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  // PIN sign-in: default view on a device that remembers an account with a PIN; "PIN instead" elsewhere.
  const [pinDevice, setPinDevice] = useState<{ name: string; email: string } | null>(null);
  const [knownUser, setKnownUser] = useState<{ name: string; email: string } | null>(null);
  const [pinManual, setPinManual] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [pinChecked, setPinChecked] = useState(false);

  useEffect(() => {
    api.get<{ device: boolean; name?: string; email?: string; hasPin?: boolean }>("/api/auth/pin/device?portal=admin")
      .then((d) => {
        if (!d.device || !d.name || !d.email) return;
        if (d.hasPin) setPinDevice({ name: d.name, email: d.email });
        else { setKnownUser({ name: d.name, email: d.email }); setEmail(d.email); }
      })
      .catch(() => { /* password form stays */ })
      .finally(() => setPinChecked(true));
  }, []);

  useEffect(() => {
    if (isLoading || rejecting) return;
    if (isAuthenticated && user) {
      if (user.role === "USER") {
        // A normal-user account authenticated through the admin door — never let them into
        // the admin shell; sign them back out and explain, rather than silently redirecting
        // them into their own dashboard (which would blur the "separate portal" boundary).
        setRejecting(true);
        void logout().then(() => {
          setError("This sign-in is for Penny Pilot administrators only.");
          setRejecting(false);
        });
        return;
      }
      router.replace("/admin");
    }
  }, [isAuthenticated, isLoading, user, router, logout, rejecting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(true);
    try {
      const result = await login(email.trim(), password, "admin", rememberMe);
      if (result.requiresPasswordChange && result.passwordChangeToken) {
        setPasswordChangeToken(result.passwordChangeToken);
      } else if (result.requires2FA && result.challengeToken) {
        setChallengeToken(result.challengeToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
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
      await forceChangePassword(passwordChangeToken, newPassword);
      // The auth-state effect above redirects (or rejects) once `user` is populated.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set new password");
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading || !pinChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-teal-500" />
      </div>
    );
  }

  if ((pinDevice || pinManual) && !usePassword && !challengeToken && !passwordChangeToken) {
    const toPassword = () => { if (pinDevice) { setEmail(pinDevice.email); setKnownUser(pinDevice); } setPinManual(false); setUsePassword(true); };
    const notYou = () => { setPinDevice(null); setKnownUser(null); setEmail(""); setPinManual(true); };
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="flex w-full max-w-sm flex-col gap-3">
          {!pinDevice && (
            <input
              type="text"
              autoComplete="username"
              aria-label="Administrator email or User ID"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email or User ID required"
              className={inputBase.replace("pl-10", "pl-4")}
            />
          )}
          <AnimatedCodeVerification
            length={4}
            title={pinDevice ? `Welcome back, ${pinDevice.name.split(" ")[0]}` : "Sign in with PIN"}
            subtitle={pinDevice ? `Enter your 4-digit PIN to open the admin console as ${pinDevice.email}` : "Enter your administrator email or User ID, then your 4-digit PIN"}
            tip="Locked out? Use your email and password below"
            successTitle="Verified"
            successSubtitle="Opening the admin console…"
            onVerify={async (pin) => {
              if (!pinDevice && !email.trim()) throw new Error("Enter your email or User ID first");
              const result = await loginWithPin(pin, pinDevice ? undefined : email.trim(), "admin");
              if (result.requires2FA && result.challengeToken) setChallengeToken(result.challengeToken);
              else if (result.requiresPasswordChange && result.passwordChangeToken) setPasswordChangeToken(result.passwordChangeToken);
            }}
          />
          <button type="button" onClick={toPassword} className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-slate-200 hover:bg-white/[0.06]">
            <Mail className="h-4 w-4" /> Sign in with email &amp; password
          </button>
          {pinDevice && (
            <button type="button" onClick={notYou} className="min-h-[44px] text-sm text-slate-500 hover:text-slate-300">
              Not {pinDevice.name.split(" ")[0]}? Use a different account
            </button>
          )}
        </div>
      </div>
    );
  }

  if (challengeToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <AnimatedCodeVerification
          length={6}
          title="Verify Administrator Identity"
          subtitle="Enter the 6-digit code from your authenticator app"
          successTitle="Verified"
          successSubtitle="Opening the admin console…"
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 p-6">
          <div className="mb-5 flex items-center gap-2 text-slate-100">
            <Lock className="h-5 w-5 text-teal-500" />
            <h1 className="text-base font-semibold">Set a new password</h1>
          </div>
          <form onSubmit={handleForceChangePassword} className="space-y-4">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters, letter + number"
                required
                autoFocus
                className={inputBase}
                toggleClassName="text-slate-500 hover:text-slate-300"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <PasswordInput
                id="confirmNewPassword"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className={inputBase}
                toggleClassName="text-slate-500 hover:text-slate-300"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <button type="submit" disabled={isPending || !newPassword || !confirmNewPassword} className={primaryButton}>
              {isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Lock className="h-4 w-4" />}
              {isPending ? "Saving…" : "Set New Password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
            <ShieldAlert className="h-5 w-5 text-teal-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-100">Penny Pilot — Admin Console</h1>
          <p className="text-xs text-slate-500">Restricted access. Authorized administrators only.</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Administrator sign-in">
            {knownUser ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-center">
                <p className="text-sm font-semibold text-slate-100">Welcome back, {knownUser.name.split(" ")[0]}</p>
                <p className="mt-0.5 text-xs text-slate-500">{knownUser.email}</p>
                <button type="button" onClick={() => { setKnownUser(null); setEmail(""); }} className="mt-2 min-h-[44px] text-xs text-slate-500 hover:text-slate-300">
                  Not {knownUser.name.split(" ")[0]}? Use a different account
                </button>
              </div>
            ) : (
            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-xs font-medium text-slate-400">
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="admin-email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email or User ID required"
                  required
                  autoFocus
                  className={inputBase}
                />
              </div>
            </div>
            )}

            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-xs font-medium text-slate-400">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <PasswordInput
                  id="admin-password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={inputBase}
                  toggleClassName="text-slate-500 hover:text-slate-300"
                />
              </div>
              <div className="mt-2 flex justify-end">
                <Link href="/forgot-password" className="text-xs text-slate-500 transition-colors hover:text-slate-300 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-slate-300">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-5 w-5 rounded border-white/20 bg-white/[0.03] accent-teal-500" />
              Remember me on this device
            </label>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <button type="submit" disabled={isPending || !email || !password} className={primaryButton}>
              {isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <ShieldAlert className="h-4 w-4" />}
              {isPending ? "Signing in…" : "Sign In to Admin Console"}
            </button>

            <button type="button" onClick={() => { setError(""); setUsePassword(false); setPinManual(true); }} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-slate-200 hover:bg-white/[0.06]">
              <KeyRound className="h-4 w-4" /> Sign in with PIN instead
            </button>
          </form>
        </div>

        <Link href="/login" className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Penny Pilot sign-in
        </Link>
      </div>
    </div>
  );
}
