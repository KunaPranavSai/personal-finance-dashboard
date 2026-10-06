"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Lightbulb, Check, KeyRound } from "lucide-react";

type Phase = "input" | "orbiting" | "verifying" | "success" | "error";

interface AnimatedCodeVerificationProps {
  /** Number of digit boxes for the primary code (TOTP codes in this app are 6 digits). */
  length?: number;
  title: string;
  subtitle: React.ReactNode;
  tip?: string;
  successTitle?: string;
  successSubtitle?: string;
  /** Throw (or reject) to signal an invalid code — the component handles the error UI/reset itself. */
  onVerify: (code: string) => Promise<void>;
  /** Called once the success animation has finished playing. */
  onSuccess?: () => void;
  /** Optional secondary action, e.g. "Back to sign in". */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Backup codes are longer alphanumeric strings — shown as a plain-text fallback instead of fixed digit boxes. */
  allowBackupCode?: boolean;
}

const ORBIT_MS = 900;
const VERIFY_MIN_MS = 700;
const SUCCESS_HOLD_MS = 1400;
const SHAKE_MS = 650; // the shake is brief; the message itself stays until the person edits the code

export function AnimatedCodeVerification({
  length = 6,
  title,
  subtitle,
  tip = "Tip: You can paste the full code directly",
  successTitle = "Verified Successfully!",
  successSubtitle = "Your identity has been confirmed",
  onVerify,
  onSuccess,
  onCancel,
  cancelLabel = "Back",
  allowBackupCode = false,
}: AnimatedCodeVerificationProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const [backupMode, setBackupMode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Locked, rate-limited or expired: more attempts cannot help, so input stops and the message stays with a way out.
  const [terminal, setTerminal] = useState(false);
  const reduceMotion = useReducedMotion();
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const runIdRef = useRef(0);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, [backupMode]);

  const resetDigits = useCallback(() => {
    setDigits(Array(length).fill(""));
    requestAnimationFrame(() => inputsRef.current[0]?.focus());
  }, [length]);

  const runVerification = useCallback(async (code: string) => {
    const myRun = ++runIdRef.current;
    setPhase("orbiting");
    const started = Date.now();
    try {
      await new Promise((r) => setTimeout(r, ORBIT_MS));
      if (runIdRef.current !== myRun) return;
      setPhase("verifying");
      await onVerify(code);
      const elapsed = Date.now() - started;
      if (elapsed < VERIFY_MIN_MS) await new Promise((r) => setTimeout(r, VERIFY_MIN_MS - elapsed));
      if (runIdRef.current !== myRun) return;
      setPhase("success");
      setTimeout(() => { if (runIdRef.current === myRun) onSuccess?.(); }, SUCCESS_HOLD_MS);
    } catch (err) {
      if (runIdRef.current !== myRun) return;
      const status = (err as { status?: number })?.status;
      const code = (err as { details?: { code?: string } })?.details?.code;
      const stop = status === 423 || status === 429 || code === "AUTH_EXPIRED" || /too many|locked|expired.*(log|sign)/i.test(err instanceof Error ? err.message : "");
      setErrorMessage(err instanceof Error ? err.message : "That didn't work. Check the code and try again.");
      setTerminal(stop);
      setPhase("error");
      setTimeout(() => {
        if (runIdRef.current !== myRun) return;
        setPhase("input");
        if (!stop) resetDigits();
        setBackupCode("");
      }, SHAKE_MS);
    }
  }, [onVerify, onSuccess, resetDigits]);

  const handleDigitChange = (index: number, raw: string) => {
    if (errorMessage && !terminal) setErrorMessage("");
    const value = raw.replace(/\D/g, "");
    if (!value) {
      setDigits((d) => { const next = [...d]; next[index] = ""; return next; });
      return;
    }
    // Paste of the whole code into one box: spread across remaining boxes.
    if (value.length > 1) {
      const chars = value.slice(0, length - index).split("");
      setDigits((d) => {
        const next = [...d];
        chars.forEach((c, i) => { next[index + i] = c; });
        return next;
      });
      const lastFilled = Math.min(index + chars.length, length - 1);
      inputsRef.current[lastFilled]?.focus();
      if (index + chars.length >= length) {
        const full = digits.map((d, i) => chars[i - index] ?? d).join("").slice(0, length);
        if (full.length === length) void runVerification(full);
      }
      return;
    }
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (next.every((v) => v) && index === length - 1) void runVerification(next.join(""));
    else if (index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleBackupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (backupCode.trim()) void runVerification(backupCode.trim());
  };

  const isBusy = phase === "orbiting" || phase === "verifying" || phase === "success";

  return (
    <div className="relative w-full max-w-sm">
      <AnimatePresence mode="wait">
        {phase === "input" || phase === "error" ? (
          <motion.div
            key="input-card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              x: phase === "error" && !reduceMotion ? [0, -8, 8, -6, 6, -2, 2, 0] : 0,
            }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="rounded-2xl border border-pp-border bg-pp-surface-2 p-8 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <div className="relative flex h-14 w-14 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-pp-accent/30 blur-xl" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pp-accent/20 to-pp-accent/20 border border-pp-border">
                  <ShieldCheck className="h-6 w-6 text-pp-accent/40" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-pp-text">{title}</h2>
                <p className="mt-1 text-sm text-pp-text-dim">{subtitle}</p>
              </div>
            </div>

            {!backupMode ? (
              <div className="flex justify-center gap-2.5">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputsRef.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={length}
                    value={d}
                    autoFocus={i === 0}
                    disabled={terminal}
                    aria-label={`Digit ${i + 1} of ${length}`}
                    aria-invalid={errorMessage ? true : undefined}
                    aria-describedby={errorMessage ? "code-error" : undefined}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={`h-14 w-11 rounded-xl border bg-pp-surface-2 text-center text-xl font-semibold text-pp-text outline-none transition-all focus:ring-2 ${
                      d
                        ? "border-pp-accent/60"
                        : "border-pp-border focus:border-pp-accent focus:ring-pp-accent/25"
                    }`}
                  />
                ))}
              </div>
            ) : (
              <form onSubmit={handleBackupSubmit} className="space-y-3">
                <input
                  type="text"
                  autoFocus
                  autoComplete="off"
                  value={backupCode}
                  onChange={(e) => { setBackupCode(e.target.value); if (errorMessage && !terminal) setErrorMessage(""); }}
                  disabled={terminal}
                  aria-label="Backup code"
                  aria-invalid={errorMessage ? true : undefined}
                  aria-describedby={errorMessage ? "code-error" : undefined}
                  placeholder="Backup code"
                  className="w-full rounded-xl border border-pp-border bg-pp-surface-2 px-4 py-3 text-center text-sm tracking-wide text-pp-text placeholder:text-pp-text-dim/70 outline-none transition-all focus:border-pp-accent focus:ring-2 focus:ring-pp-accent/25"
                />
                <button
                  type="submit"
                  disabled={!backupCode.trim()}
                  className="w-full rounded-xl bg-pp-accent px-4 py-2.5 text-sm font-semibold text-pp-accent-ink shadow-pp transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                >
                  Verify
                </button>
              </form>
            )}

            {errorMessage && (
              <p id="code-error" role="alert" className="mt-4 rounded-lg bg-pp-critical/10 px-3 py-2 text-center text-sm font-medium text-pp-critical">
                {errorMessage}
                {terminal && onCancel && <span className="mt-1 block text-xs font-normal text-pp-text-dim">Use “{cancelLabel}” below to start again.</span>}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-pp-text-dim">
              <Lightbulb className="h-3.5 w-3.5 shrink-0 text-pp-warning" />
              <span>{backupMode ? "Enter one of your saved backup codes" : tip}</span>
            </div>

            {allowBackupCode && (
              <button
                type="button"
                onClick={() => { setBackupMode((v) => !v); setErrorMessage(""); }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-pp-text-dim transition-colors hover:text-pp-text"
              >
                <KeyRound className="h-3 w-3" />
                {backupMode ? "Use authenticator code instead" : "Use a backup code instead"}
              </button>
            )}

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="mt-2 w-full text-center text-xs text-pp-text-dim transition-colors hover:text-pp-text"
              >
                {cancelLabel}
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="progress-card"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center gap-8 rounded-2xl border border-pp-border bg-pp-surface-2 p-10 shadow-2xl backdrop-blur-xl"
          >
            <div className="relative flex h-40 w-40 items-center justify-center">
              {phase === "orbiting" && (
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                >
                  {digits.map((d, i) => {
                    const angle = (i / length) * 2 * Math.PI;
                    const radius = 64;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    return (
                      <motion.div
                        key={i}
                        className="absolute left-1/2 top-1/2 flex h-9 w-9 items-center justify-center rounded-lg border border-pp-accent/40 bg-pp-chip-bg text-sm font-semibold text-pp-text"
                        style={{ x: x - 18, y: y - 18 }}
                        animate={{ rotate: -360 }}
                        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                      >
                        {d}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {phase === "verifying" && (
                <>
                  <motion.div
                    className="absolute h-28 w-28 rounded-full border-2 border-pp-accent/50"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.3, 0.8] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute h-20 w-20 rounded-full border-2 border-pp-accent/50"
                    animate={{ scale: [1, 1.25, 1], opacity: [0.9, 0.2, 0.9] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                  />
                  <div className="absolute h-12 w-12 rounded-full bg-pp-accent/30 blur-lg" />
                </>
              )}

              {phase === "success" && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="relative flex h-20 w-20 items-center justify-center"
                >
                  <motion.div
                    className="absolute inset-0 rounded-full bg-mantis/30 blur-xl"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-mantis">
                    <Check className="h-8 w-8 text-pp-text" strokeWidth={3} />
                  </div>
                </motion.div>
              )}
            </div>

            <div className="text-center">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={phase}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="text-lg font-bold text-pp-text"
                >
                  {phase === "orbiting" && "Orbiting your code…"}
                  {phase === "verifying" && "Verifying your code…"}
                  {phase === "success" && successTitle}
                </motion.h2>
              </AnimatePresence>
              <p className="mt-1 text-sm text-pp-text-dim">
                {phase === "success" ? successSubtitle : "Just a moment"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Prevents interaction with stale boxes while a verification is mid-flight. */}
      {isBusy && <div className="absolute inset-0" aria-hidden />}
    </div>
  );
}
