"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth, POST_LOGIN_REDIRECT_KEY, SESSION_EXPIRED_REASON_KEY } from "@/lib/AuthContext";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useToast } from "@/components/ui/Toast";
import { playVoiceGreeting, VOICE_GREETINGS, isVoiceGreetingsEnabled } from "@/lib/voiceGreeting";
import { Footer } from "@/components/layout/Footer";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { AnimatedCheckbox } from "@/components/ui/AnimatedCheckbox";
import { AnimatedCodeVerification } from "@/components/ui/AnimatedCodeVerification";
import { ShieldCheck, Lock, Mail, AlertCircle } from "lucide-react";
import { cn } from "@/lib/format";
import { api } from "@/lib/api";
import { hasFunctionalConsent } from "@/lib/cookieConsent";

const REMEMBERED_EMAIL_KEY = "pfd-remembered-email";

const inputBase =
  "w-full rounded-xl border border-pp-border bg-pp-surface-2 py-3 pl-10 pr-4 text-sm text-pp-text placeholder:text-pp-text-dim/70 outline-none transition-all focus:border-pp-accent focus:ring-2 focus:ring-pp-accent/25";

const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-pp-accent px-4 py-3 text-sm font-semibold text-pp-accent-ink shadow-pp transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";

import { usePasswordPolicy } from "@/lib/passwordPolicy";
import { errorCodeOf } from "@/lib/errorMessage";

function ErrorMessage({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={typeof children === "string" ? children : "error"}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto", x: reduce ? 0 : [0, -6, 6, -4, 4, 0] }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.35 }}
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-vulcanico/20 bg-vulcanico/10 px-3 py-2 text-sm text-pp-critical"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function SuccessMessage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-center gap-2 rounded-lg border border-pp-accent/20 bg-pp-accent/10 px-3 py-2 text-sm text-pp-accent/40"
    >
      <ShieldCheck className="h-4 w-4 shrink-0" />
      {children}
    </motion.div>
  );
}

interface LoginPageClientProps {
  /** True when rendered inside LoginModal on the landing page instead of the
   * standalone /login route — swaps full-viewport chrome for a self-sized
   * panel. No auth/logic differences. */
  embedded?: boolean;
}

export function LoginPageClient({ embedded = false }: LoginPageClientProps = {}) {
  const { user, login, loginWithPin, verifyLogin2FA, forceChangePassword, isAuthenticated, isLoading } = useAuth();
  const { settings } = useSettingsContext();
  const { toast } = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string; newPassword?: string; confirm?: string }>({});
  const policy = usePasswordPolicy();
  const [isPending, setIsPending] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [passwordChangeToken, setPasswordChangeToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [info, setInfo] = useState("");
  // Set when this device remembers an account with a PIN: PIN entry is the default view.
  const [pinDevice, setPinDevice] = useState<{ name: string; email: string; uid: string } | null>(null);
  // Last account that signed in here without a PIN: greeted by name, email not asked again.
  const [knownUser, setKnownUser] = useState<{ name: string; email: string } | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const [pinChecked, setPinChecked] = useState(false);
  // New device: no remembered account, so the user types their email / User ID next to the PIN.
  const [pinManual, setPinManual] = useState(false);

  useEffect(() => {
    api.get<{ device: boolean; uid?: string; name?: string; email?: string; hasPin?: boolean }>("/api/auth/pin/device")
      .then((d) => {
        if (!d.device || !d.name || !d.email) return;
        if (d.hasPin) setPinDevice({ name: d.name, email: d.email, uid: d.uid || d.email });
        else { setKnownUser({ name: d.name, email: d.email }); setEmail(d.email); }
      })
      .catch(() => { /* no PIN view: password form stays */ })
      .finally(() => setPinChecked(true));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const remembered = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    const registeredEmail = params.get("registered") === "1" ? params.get("email") : null;
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    } else if (registeredEmail) {
      setEmail(registeredEmail);
      setRememberMe(false);
    } else {
      setRememberMe(false);
    }
    if (registeredEmail) {
      setInfo("Your account has been created. Sign in below to get started.");
    }
    const expiredReason = sessionStorage.getItem(SESSION_EXPIRED_REASON_KEY);
    if (expiredReason === "inactivity") {
      sessionStorage.removeItem(SESSION_EXPIRED_REASON_KEY);
      setError("Your session expired due to inactivity.");
    } else if (expiredReason === "cookie-not-persisted") {
      sessionStorage.removeItem(SESSION_EXPIRED_REASON_KEY);
      setError(
        "You signed in, but your browser didn't keep you signed in. This usually happens when a browser blocks " +
        "cross-site cookies (e.g. Safari's \"Prevent Cross-Site Tracking\", or a private/incognito window). " +
        "Try again, or use a different browser if this keeps happening."
      );
    }
  }, []);

  // Fires once, right at the moment a login attempt actually succeeds (an
  // event-handler call site, not an effect), so a fast re-render can never
  // trigger it twice for the same sign-in.
  const greetLogin = (isFirstLogin: boolean) => {
    const key = isFirstLogin ? "firstLogin" : "login";
    const enabled = isVoiceGreetingsEnabled(settings.preferences);
    playVoiceGreeting(key, { enabled });
    toast(VOICE_GREETINGS[key], "success");
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
    // Tell the person exactly what is missing, next to the field, instead of a disabled button.
    const problems: typeof fieldErr = {};
    if (!email.trim()) problems.email = "Enter your email or User ID.";
    else if (/\s/.test(email.trim())) problems.email = "Your email or User ID can't contain spaces.";
    if (!password) problems.password = "Enter your password.";
    setFieldErr(problems);
    if (problems.email || problems.password) {
      document.getElementById(problems.email ? "email" : "password")?.focus();
      return;
    }
    setIsPending(true);
    try {
      const result = await login(email.trim(), password, undefined, rememberMe);
      try {
        // Remembering a sign-in email is a "Functional" (non-essential)
        // cookie-consent category — see lib/cookieConsent.ts and /cookie-notice.
        if (rememberMe && hasFunctionalConsent()) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase());
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      } catch {
        // ignore storage failures (private browsing, etc.)
      }
      if (result.requiresPasswordChange && result.passwordChangeToken) {
        setPasswordChangeToken(result.passwordChangeToken);
      } else if (result.requires2FA && result.challengeToken) {
        setChallengeToken(result.challengeToken);
      } else {
        greetLogin(Boolean(result.isFirstLogin));
      }
      // else: the auth-state effect above redirects once `user` is populated.
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      // Backend rejects an ADMIN/SUPER_ADMIN credential submitted here (portal separation is
      // enforced server-side, not just by hiding nav) — send them to the right door instead of
      // showing a dead-end error.
      if (message === "Administrators sign in at the Admin Console.") {
        router.replace("/admin-login");
        return;
      }
      // Account inside its 30-day deletion period: sign-in is closed, reactivation is the way back.
      if (errorCodeOf(err) === "ACCOUNT_DELETION_SCHEDULED" || /scheduled for deletion/i.test(message)) {
        router.replace(`/reactivate?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(message);
    } finally {
      setIsPending(false);
    }
  };

  const handleForceChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordChangeToken) return;
    setError("");
    const problems: typeof fieldErr = {};
    const rule = policy.problem(newPassword);
    if (!newPassword) problems.newPassword = "Choose a new password.";
    else if (rule) problems.newPassword = rule;
    if (!confirmNewPassword) problems.confirm = "Re-enter the new password.";
    else if (newPassword !== confirmNewPassword) problems.confirm = "The two passwords don't match.";
    setFieldErr(problems);
    if (problems.newPassword || problems.confirm) {
      document.getElementById(problems.newPassword ? "newPassword" : "confirmNewPassword")?.focus();
      return;
    }
    setIsPending(true);
    try {
      const { justOnboarded, user: updatedUser, isFirstLogin } = await forceChangePassword(passwordChangeToken, newPassword);
      greetLogin(isFirstLogin);
      router.replace(resolveDestination(updatedUser?.role ?? "USER", justOnboarded));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set new password");
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading || !pinChecked) {
    return (
      <div className={cn("flex items-center justify-center bg-pp-bg", embedded ? "p-16" : "min-h-screen")}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-pp-accent/30 border-t-pp-accent" />
      </div>
    );
  }

  if (challengeToken) {
    return (
      <div className={cn("relative flex items-center justify-center overflow-hidden bg-pp-bg p-4", embedded ? "" : "min-h-screen")}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-pp-accent/10 blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-pp-accent/20 blur-[100px]" />
        </div>
        <AnimatedCodeVerification
          length={6}
          title="Verify Your Identity"
          subtitle="Enter the 6-digit code from your authenticator app"
          successTitle="Signed In Successfully!"
          successSubtitle="Redirecting to your dashboard…"
          allowBackupCode
          onVerify={async (code) => {
            const { isFirstLogin } = await verifyLogin2FA(challengeToken, code);
            greetLogin(isFirstLogin);
          }}
          onCancel={() => setChallengeToken(null)}
          cancelLabel="Back to sign in"
        />
      </div>
    );
  }

  if ((pinDevice || pinManual) && !usePassword && !passwordChangeToken) {
    const switchToPassword = () => { if (pinDevice) { setEmail(pinDevice.email); setKnownUser(pinDevice); } setPinManual(false); setUsePassword(true); };
    const notYou = () => { setPinDevice(null); setKnownUser(null); setEmail(""); setPinManual(true); };
    return (
      <div className={cn("relative flex items-center justify-center overflow-hidden bg-pp-bg p-4", embedded ? "" : "min-h-screen")}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-pp-accent/10 blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-pp-accent/20 blur-[100px]" />
        </div>
        <div className="relative flex w-full max-w-sm flex-col items-stretch gap-3">
          {!pinDevice && (
            <input
              id="pin-identifier"
              type="text"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email or User ID required"
              className={inputBase}
              aria-label="Email or User ID"
            />
          )}
          <AnimatedCodeVerification
            length={4}
            title={pinDevice ? "Welcome back" : "Sign in with PIN"}
            subtitle={pinDevice ? <><span className="mb-1 block break-all text-base font-semibold text-pp-text">{pinDevice.uid}</span>Enter your 4-digit PIN</> : "Enter your email or User ID, then your 4-digit PIN"}
            tip="Locked out? Use your email and password below"
            successTitle="Signed In Successfully!"
            successSubtitle="Redirecting to your dashboard…"
            onVerify={async (pin) => {
              if (!pinDevice && !email.trim()) throw new Error("Enter your email or User ID first");
              const result = await loginWithPin(pin, pinDevice ? undefined : email.trim());
              if (result.requires2FA && result.challengeToken) { setChallengeToken(result.challengeToken); return; }
              if (result.requiresPasswordChange && result.passwordChangeToken) { setPasswordChangeToken(result.passwordChangeToken); return; }
              greetLogin(Boolean(result.isFirstLogin));
            }}
          />
          <button
            type="button"
            onClick={switchToPassword}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-pp-border bg-pp-surface-2 px-4 text-sm font-medium text-pp-text transition hover:bg-pp-chip-bg"
          >
            <Mail className="h-4 w-4" /> Sign in with email &amp; password
          </button>
          {pinDevice && (
            <button type="button" onClick={notYou} className="min-h-[44px] text-sm text-pp-text-dim transition hover:text-pp-text">
              Not you? Switch account
            </button>
          )}
        </div>
      </div>
    );
  }

  if (passwordChangeToken) {
    return (
      <AuthPageShell embedded={embedded} icon={Lock} title="Create a new password" subtitle="You're using a temporary password — set a permanent one to continue">
        <form onSubmit={handleForceChangePassword} noValidate className="space-y-5">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pp-text-dim" />
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setFieldErr((f) => ({ ...f, newPassword: undefined })); }}
              placeholder="At least 8 characters, letter + number"
              aria-invalid={fieldErr.newPassword ? true : undefined}
              aria-describedby={fieldErr.newPassword ? "newPassword-err" : "newPassword-hint"}
              autoFocus
              className={inputBase}
              toggleClassName="text-pp-text-dim hover:text-pp-text"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pp-text-dim" />
            <PasswordInput
              id="confirmNewPassword"
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => { setConfirmNewPassword(e.target.value); setFieldErr((f) => ({ ...f, confirm: undefined })); }}
              placeholder="Re-enter new password"
              aria-invalid={fieldErr.confirm ? true : undefined}
              aria-describedby={fieldErr.confirm ? "confirm-err" : undefined}
              className={inputBase}
              toggleClassName="text-pp-text-dim hover:text-pp-text"
            />
          </div>
          {fieldErr.newPassword ? <p id="newPassword-err" role="alert" className="-mt-3 text-xs font-medium text-pp-critical">{fieldErr.newPassword}</p> : <p id="newPassword-hint" className="-mt-3 text-xs text-pp-text-dim">{policy.hint}</p>}
          {fieldErr.confirm && <p id="confirm-err" role="alert" className="-mt-3 text-xs font-medium text-pp-critical">{fieldErr.confirm}</p>}
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending} className={primaryButton}>
            {isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-pp-border border-t-pp-accent" /> : <Lock className="h-4 w-4" />}
            {isPending ? "Saving…" : "Set New Password"}
          </motion.button>
        </form>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      embedded={embedded}
      icon={ShieldCheck}
      title="Welcome Back"
      subtitle="Access your account to continue"
      footer={embedded ? undefined : <Footer variant="dark" />}
    >
      <AnimatePresence mode="wait">
        {(
          <motion.form key="password" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} onSubmit={handleSubmit} noValidate className="space-y-5">
            {info && <SuccessMessage>{info}</SuccessMessage>}


            {knownUser ? (
              <div className="rounded-xl border border-pp-border bg-pp-surface-2 p-4 text-center">
                <p className="text-base font-semibold text-pp-text">Welcome back, {knownUser.name.split(" ")[0]}</p>
                <p className="mt-0.5 text-xs text-pp-text-dim">{knownUser.email}</p>
                <button type="button" onClick={() => { setKnownUser(null); setEmail(""); }} className="mt-2 min-h-[44px] text-xs text-pp-text-dim transition hover:text-pp-text">
                  Not {knownUser.name.split(" ")[0]}? Use a different account
                </button>
              </div>
            ) : (
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-pp-text-dim">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pp-text-dim" />
                <input
                  id="email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErr((f) => ({ ...f, email: undefined })); }}
                  placeholder="Email or User ID required"
                  aria-invalid={fieldErr.email ? true : undefined}
                  aria-describedby={fieldErr.email ? "email-err" : undefined}
                  className={inputBase}
                />
              </div>
              {fieldErr.email && <p id="email-err" role="alert" className="mt-1.5 text-xs font-medium text-pp-critical">{fieldErr.email}</p>}
            </div>
            )}

            <div>
              <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-pp-text-dim">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pp-text-dim" />
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErr((f) => ({ ...f, password: undefined })); }}
                  placeholder="Enter your password"
                  aria-invalid={fieldErr.password ? true : undefined}
                  aria-describedby={fieldErr.password ? "password-err" : undefined}
                  className={inputBase}
                  toggleClassName="text-pp-text-dim hover:text-pp-text"
                />
              </div>
              {fieldErr.password && <p id="password-err" role="alert" className="mt-1.5 text-xs font-medium text-pp-critical">{fieldErr.password}</p>}
              <div className="mt-3 flex items-center justify-between">
                <AnimatedCheckbox id="remember-me" checked={rememberMe} onChange={setRememberMe} label="Remember me" />
                <Link href="/forgot-password" className="text-xs text-pp-accent transition-colors hover:opacity-80 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending} className={primaryButton}>
              {isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-pp-border border-t-pp-accent" /> : <Lock className="h-4 w-4" />}
              {isPending ? "Signing in…" : "Sign In"}
            </motion.button>

            <button type="button" onClick={() => { setError(""); setPinManual(true); }} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-pp-border bg-pp-surface-2 px-4 text-sm font-medium text-pp-text transition hover:bg-pp-chip-bg">
              Sign in with PIN instead
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <p className="mt-6 text-center text-xs text-pp-text-dim">
        New here?{" "}
        <Link href="/signup" className="font-medium text-pp-accent transition-colors hover:opacity-80">
          Get started
        </Link>
      </p>
    </AuthPageShell>
  );
}
