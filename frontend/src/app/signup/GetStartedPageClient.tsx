"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Rocket, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { isEmail } from "@/lib/zodHelpers";
import { AnimatedCodeVerification } from "@/components/ui/AnimatedCodeVerification";

const inputBase =
  "w-full rounded-xl border border-pp-border bg-pp-surface-2 py-3 pl-10 pr-4 text-sm text-pp-text placeholder-pp-text-dim outline-none transition focus:border-pp-accent focus:ring-2 focus:ring-pp-accent/25";

/**
 * Get Started: one field. A new email drops you straight into the dashboard as an explorer; an email that already
 * belongs to a verified account gets a sign-in code instead (a typed email alone never opens an existing account).
 */
export function GetStartedPageClient() {
  const router = useRouter();
  const { startWithEmail, loginWithCode } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);

  // A new code for the same address (the old one expires after 10 minutes).
  const resend = async () => {
    if (!codeFor) return;
    setResending(true);
    setResendMsg("");
    try {
      await startWithEmail(codeFor);
      setResendMsg("A new code is on its way. Check your inbox and spam folder.");
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : "We couldn't send a new code. Try again in a minute.");
    } finally {
      setResending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const value = email.trim();
    if (!value) { setEmailErr("Enter your email address."); document.getElementById("email")?.focus(); return; }
    if (!isEmail(value)) { setEmailErr("That doesn't look like an email address. Use the form name@example.com."); document.getElementById("email")?.focus(); return; }
    setEmailErr("");
    setBusy(true);
    try {
      const mode = await startWithEmail(value);
      if (mode === "explore") router.replace("/dashboard");
      else setCodeFor(email.trim().toLowerCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get started");
    } finally {
      setBusy(false);
    }
  };

  if (codeFor) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-pp-bg p-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-pp-accent/10 blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-pp-accent/20 blur-[100px]" />
        </div>
        <div className="relative flex w-full max-w-sm flex-col gap-3">
          <AnimatedCodeVerification
            length={6}
            title="Welcome back"
            subtitle={`Enter the 6-digit code we emailed to ${codeFor}`}
            tip="The code is valid for 10 minutes"
            successTitle="Signed In Successfully!"
            successSubtitle="Redirecting to your dashboard…"
            onVerify={async (code) => {
              const result = await loginWithCode(codeFor, code);
              if (result.requires2FA) throw new Error("This account uses two-factor sign-in. Please use the login page.");
            }}
            onSuccess={() => router.replace("/dashboard")}
          />
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="min-h-[48px] rounded-xl border border-pp-border bg-pp-surface-2 px-4 text-sm font-medium text-pp-text transition hover:bg-pp-chip-bg disabled:opacity-60"
          >
            {resending ? "Sending…" : "Send a new code"}
          </button>
          {resendMsg && <p role="status" className="text-center text-xs text-pp-text-dim">{resendMsg}</p>}
          <button
            type="button"
            onClick={() => { setCodeFor(null); setResendMsg(""); }}
            className="min-h-[44px] text-sm text-pp-text-dim transition hover:text-pp-text"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthPageShell
      icon={Rocket}
      title="Get started"
      subtitle="No lengthy setup. Start exploring now, and verify your email only when you want to save your own data."
      footer={
        <p className="mt-6 text-center text-sm text-pp-text-dim">
          Already have a password?{" "}
          <Link href="/login" className="font-medium text-pp-accent transition-colors hover:opacity-80">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pp-text-dim" />
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailErr(""); }}
            placeholder="Email required"
            aria-label="Email"
            aria-invalid={emailErr ? true : undefined}
            aria-describedby={emailErr ? "email-err" : undefined}
            className={inputBase}
          />
        </div>
        {emailErr && <p id="email-err" role="alert" className="-mt-3 text-sm font-medium text-pp-critical">{emailErr}</p>}
        {error && <p role="alert" className="text-sm text-pp-critical">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-pp-accent px-4 text-sm font-semibold text-pp-accent-ink transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "One moment…" : "Continue"} <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </AuthPageShell>
  );
}
