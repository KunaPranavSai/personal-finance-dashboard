"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Rocket, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { AnimatedCodeVerification } from "@/components/ui/AnimatedCodeVerification";

const inputBase =
  "w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none transition focus:border-tiffany/60 focus:ring-2 focus:ring-tiffany/20";

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const mode = await startWithEmail(email.trim());
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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-noturno p-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-cypress/25 blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-tiffany/20 blur-[100px]" />
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
            onClick={() => setCodeFor(null)}
            className="min-h-[48px] rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white/80 transition hover:bg-white/10"
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
        <p className="mt-6 text-center text-sm text-white/50">
          Already have a password?{" "}
          <Link href="/login" className="font-medium text-tiffany transition-colors hover:text-tiffany/80">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email required"
            aria-label="Email"
            className={inputBase}
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-tiffany px-4 text-sm font-semibold text-noturno transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "One moment…" : "Continue"} <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </AuthPageShell>
  );
}
