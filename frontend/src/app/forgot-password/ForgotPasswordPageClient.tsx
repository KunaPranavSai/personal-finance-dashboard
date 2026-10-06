"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePasswordPolicy } from "@/lib/passwordPolicy";
import { isEmail } from "@/lib/zodHelpers";
import { useAuth, type RecoveryMethod } from "@/lib/AuthContext";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrengthMeter } from "@/components/ui/PasswordStrengthMeter";
import { KeyRound, ArrowLeft, Mail, CheckCircle, AlertCircle, ShieldQuestion, Lock, ShieldCheck, ChevronRight } from "lucide-react";

const inputBase =
  "w-full rounded-xl border border-pp-border bg-pp-surface-2 py-3 pl-10 pr-4 text-sm text-pp-text placeholder:text-pp-text-dim/70 outline-none transition-all focus:border-pp-accent focus:ring-2 focus:ring-pp-accent/25";

const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-pp-accent px-4 py-3 text-sm font-semibold text-pp-accent-ink shadow-pp transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

function ErrorMessage({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "warning" }) {
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
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          tone === "warning" ? "border-turmeric/30 bg-turmeric/10 text-pp-warning" : "border-vulcanico/20 bg-vulcanico/10 text-pp-critical"
        }`}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

type Step = "ENTER_EMAIL" | "CHOOSE_METHOD" | "VERIFY_OTP" | "VERIFY_TOTP" | "VERIFY_SECURITY" | "SET_NEW_PASSWORD" | "SUCCESS";

/** Distinguishes failure *type* for UI messaging only — never whether the
 * account exists or which methods are configured for it. */
type ErrorKind = "generic" | "locked" | "rate_limited" | null;

const METHOD_CARDS: { method: RecoveryMethod; icon: typeof Mail; title: string; description: string }[] = [
  { method: "email_otp", icon: Mail, title: "Email verification", description: "Receive a verification code at your email address." },
  { method: "totp", icon: ShieldCheck, title: "Authenticator app", description: "Use the 6-digit code from your authenticator app." },
  { method: "security_questions", icon: ShieldQuestion, title: "Security questions", description: "Verify your identity using your recovery questions." },
];

export function ForgotPasswordPageClient() {
  const {
    requestPasswordReset,
    selectRecoveryMethod,
    resendRecoveryOtp,
    verifyRecoveryOtp,
    verifyRecoveryTotp,
    verifyRecoverySecurityAnswers,
    completePasswordReset,
  } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("ENTER_EMAIL");
  const policy = usePasswordPolicy();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [questions, setQuestions] = useState<{ key: string; text: string }[]>([]);
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const [isPending, setIsPending] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<RecoveryMethod | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  function classifyError(err: unknown): void {
    const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    setError(message);
    if (/too many|locked/i.test(message)) setErrorKind("locked");
    else if (/wait/i.test(message)) setErrorKind("rate_limited");
    else setErrorKind("generic");
  }

  function startOver() {
    setStep("ENTER_EMAIL");
    setError("");
    setErrorKind(null);
    setCode("");
    setAnswer1("");
    setAnswer2("");
    setQuestions([]);
    setPendingMethod(null);
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorKind(null);
    setIsPending(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setStep("CHOOSE_METHOD");
    } catch (err) {
      classifyError(err);
    } finally {
      setIsPending(false);
    }
  };

  const handleChooseMethod = async (method: RecoveryMethod) => {
    setError("");
    setErrorKind(null);
    setPendingMethod(method);
    try {
      const result = await selectRecoveryMethod(method);
      if (result.method === "email_otp") {
        setStep("VERIFY_OTP");
      } else if (result.method === "totp") {
        setStep("VERIFY_TOTP");
      } else {
        setQuestions(result.questions ?? []);
        setStep("VERIFY_SECURITY");
      }
    } catch (err) {
      classifyError(err);
    } finally {
      setPendingMethod(null);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setErrorKind(null);
    try {
      await resendRecoveryOtp();
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) { clearInterval(interval); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      classifyError(err);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorKind(null);
    setIsPending(true);
    try {
      await verifyRecoveryOtp(code.trim());
      setStep("SET_NEW_PASSWORD");
    } catch (err) {
      classifyError(err);
    } finally {
      setIsPending(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorKind(null);
    setIsPending(true);
    try {
      await verifyRecoveryTotp(code.trim());
      setStep("SET_NEW_PASSWORD");
    } catch (err) {
      classifyError(err);
    } finally {
      setIsPending(false);
    }
  };

  const handleSecurityAnswersSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorKind(null);
    setIsPending(true);
    try {
      await verifyRecoverySecurityAnswers(answer1, answer2);
      setStep("SET_NEW_PASSWORD");
    } catch (err) {
      classifyError(err);
    } finally {
      setIsPending(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorKind(null);
    if (newPassword !== confirmPassword) {
      setError("The two passwords don't match. Re-enter them to be sure.");
      setErrorKind("generic");
      return;
    }
    const rule = policy.problem(newPassword);
    if (rule) {
      setError(rule);
      setErrorKind("generic");
      return;
    }
    setIsPending(true);
    try {
      await completePasswordReset(newPassword);
      setStep("SUCCESS");
      setCode("");
      setAnswer1("");
      setAnswer2("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      classifyError(err);
    } finally {
      setIsPending(false);
    }
  };

  const subtitle =
    step === "ENTER_EMAIL" ? "Enter your email to begin"
    : step === "CHOOSE_METHOD" ? "Choose a recovery method"
    : step === "VERIFY_OTP" ? "Enter the 6-digit code we emailed you"
    : step === "VERIFY_TOTP" ? "Enter your authenticator code"
    : step === "VERIFY_SECURITY" ? "Answer your security questions"
    : step === "SET_NEW_PASSWORD" ? "Choose a new password"
    : "Your password has been reset";

  const canGoBackToMethods = step === "VERIFY_OTP" || step === "VERIFY_TOTP" || step === "VERIFY_SECURITY";

  return (
    <AuthPageShell icon={KeyRound} title="Reset Password" subtitle={subtitle} pulse={step !== "SUCCESS"}>
      <AnimatePresence mode="wait">
        {step === "ENTER_EMAIL" && (
          <motion.form key="email" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} onSubmit={handleEmailSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-pp-text-dim">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pp-text-dim" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className={inputBase}
                />
              </div>
            </div>

            {error && <ErrorMessage tone={errorKind === "locked" || errorKind === "rate_limited" ? "warning" : "error"}>{error}</ErrorMessage>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending || !email} className={primaryButton}>
              {isPending ? "Continuing…" : "Continue"}
            </motion.button>
          </motion.form>
        )}

        {step === "CHOOSE_METHOD" && (
          <motion.div key="choose" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} className="space-y-3">
            <p className="mb-1 text-center text-xs text-pp-text-dim">
              Select a method you have access to. Availability may vary by account.
            </p>
            {METHOD_CARDS.map(({ method, icon: Icon, title, description }) => (
              <button
                key={method}
                type="button"
                onClick={() => handleChooseMethod(method)}
                disabled={pendingMethod !== null}
                className="flex w-full items-center gap-3 rounded-xl border border-pp-border bg-pp-surface-2 p-4 text-left transition-all hover:border-pp-accent/40 hover:bg-pp-chip-bg disabled:opacity-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pp-chip-bg">
                  <Icon className="h-5 w-5 text-pp-accent/40" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-pp-text">{title}</p>
                  <p className="text-xs text-pp-text-dim">{description}</p>
                </div>
                {pendingMethod === method ? (
                  <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-pp-border border-t-pp-accent" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-pp-text-dim" />
                )}
              </button>
            ))}

            {error && <ErrorMessage tone={errorKind === "locked" || errorKind === "rate_limited" ? "warning" : "error"}>{error}</ErrorMessage>}
          </motion.div>
        )}

        {step === "VERIFY_OTP" && (
          <motion.form key="otp" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} onSubmit={handleOtpSubmit} className="space-y-5">
            <p className="text-center text-xs text-pp-text-dim">
              If a code was sent, it will arrive shortly. It expires in 5 minutes.
            </p>
            <div>
              <label htmlFor="code" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-pp-text-dim">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                aria-label="6-digit code"
                placeholder="123456"
                required
                autoFocus
                className="w-full rounded-xl border border-pp-border bg-pp-surface-2 px-4 py-3 text-center text-lg tracking-widest text-pp-text placeholder:text-pp-text-dim/70 outline-none transition-all focus:border-pp-accent focus:ring-2 focus:ring-pp-accent/25"
              />
            </div>

            {error && <ErrorMessage tone={errorKind === "locked" || errorKind === "rate_limited" ? "warning" : "error"}>{error}</ErrorMessage>}

            {errorKind === "locked" ? (
              <button type="button" onClick={startOver} className={primaryButton}>
                Start Over
              </button>
            ) : (
              <>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending || code.length !== 6} className={primaryButton}>
                  {isPending ? "Verifying…" : "Verify Code"}
                </motion.button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="w-full text-center text-xs text-pp-text-dim transition-colors hover:text-pp-text disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                </button>
              </>
            )}
          </motion.form>
        )}

        {step === "VERIFY_TOTP" && (
          <motion.form key="totp" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} onSubmit={handleTotpSubmit} className="space-y-5">
            <p className="text-center text-xs text-pp-text-dim">Enter the 6-digit code from your authenticator app (or a backup code).</p>
            <div>
              <label htmlFor="totp-code" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-pp-text-dim">
                Authenticator Code
              </label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                aria-label="6-digit code"
                placeholder="123456"
                required
                autoFocus
                className="w-full rounded-xl border border-pp-border bg-pp-surface-2 px-4 py-3 text-center text-lg tracking-widest text-pp-text placeholder:text-pp-text-dim/70 outline-none transition-all focus:border-pp-accent focus:ring-2 focus:ring-pp-accent/25"
              />
            </div>

            {error && <ErrorMessage tone={errorKind === "locked" ? "warning" : "error"}>{error}</ErrorMessage>}

            {errorKind === "locked" ? (
              <button type="button" onClick={startOver} className={primaryButton}>
                Start Over
              </button>
            ) : (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending || code.length !== 6} className={primaryButton}>
                {isPending ? "Verifying…" : "Verify Code"}
              </motion.button>
            )}
          </motion.form>
        )}

        {step === "VERIFY_SECURITY" && (
          <motion.form key="security" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} onSubmit={handleSecurityAnswersSubmit} className="space-y-5">
            {questions.map((q, i) => (
              <div key={q.key}>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pp-text-dim">
                  <ShieldQuestion className="h-3.5 w-3.5" /> {q.text}
                </label>
                <input
                  type="text"
                  value={i === 0 ? answer1 : answer2}
                  onChange={(e) => (i === 0 ? setAnswer1(e.target.value) : setAnswer2(e.target.value))}
                  required
                  autoFocus={i === 0}
                  className={inputBase.replace("pl-10", "px-4")}
                />
              </div>
            ))}

            {error && <ErrorMessage tone={errorKind === "locked" ? "warning" : "error"}>{error}</ErrorMessage>}

            {errorKind === "locked" ? (
              <button type="button" onClick={startOver} className={primaryButton}>
                Start Over
              </button>
            ) : (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending || !answer1 || !answer2} className={primaryButton}>
                {isPending ? "Verifying…" : "Verify Answers"}
              </motion.button>
            )}
          </motion.form>
        )}

        {step === "SET_NEW_PASSWORD" && (
          <motion.form key="newpass" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }} onSubmit={handleReset} className="space-y-5">
            <div>
              <label htmlFor="newPassword" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-pp-text-dim">
                New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pp-text-dim" />
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  required
                  className={inputBase}
                  toggleClassName="text-pp-text-dim hover:text-pp-text"
                />
              </div>
              <PasswordStrengthMeter password={newPassword} />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-pp-text-dim">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pp-text-dim" />
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className={inputBase}
                  toggleClassName="text-pp-text-dim hover:text-pp-text"
                />
              </div>
            </div>

            {error && <ErrorMessage tone={errorKind === "locked" ? "warning" : "error"}>{error}</ErrorMessage>}

            {errorKind === "locked" ? (
              <button type="button" onClick={startOver} className={primaryButton}>
                Start Over
              </button>
            ) : (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending || !newPassword || !confirmPassword} className={primaryButton}>
                {isPending ? "Resetting…" : "Reset Password"}
              </motion.button>
            )}
          </motion.form>
        )}

        {step === "SUCCESS" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.35 }} className="space-y-5 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative mx-auto flex h-14 w-14 items-center justify-center"
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-mantis/30 blur-xl"
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-mantis">
                <CheckCircle className="h-7 w-7 text-pp-text" />
              </div>
            </motion.div>
            <p className="text-sm text-pp-text-dim">
              Your password has been reset successfully. All other sessions have been signed out, and we&apos;ve emailed you a confirmation.
              You can now sign in with your new password.
            </p>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" onClick={() => router.push("/login")} className={primaryButton}>
              Back to sign in
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {step !== "SUCCESS" && (
        <motion.button
          type="button"
          whileHover={{ x: -3 }}
          onClick={() => (canGoBackToMethods ? setStep("CHOOSE_METHOD") : router.push("/login"))}
          className="mt-6 flex w-full items-center justify-center gap-1.5 text-xs text-pp-text-dim transition-colors hover:text-pp-text"
        >
          <ArrowLeft className="h-3 w-3" /> {canGoBackToMethods ? "Choose a different method" : "Back to sign in"}
        </motion.button>
      )}
    </AuthPageShell>
  );
}
