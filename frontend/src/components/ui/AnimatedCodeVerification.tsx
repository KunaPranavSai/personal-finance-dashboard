"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Lightbulb, Check, KeyRound } from "lucide-react";

type Phase = "input" | "orbiting" | "verifying" | "success" | "error";

interface AnimatedCodeVerificationProps {
  /** Number of digit boxes for the primary code (TOTP codes in this app are 6 digits). */
  length?: number;
  title: string;
  subtitle: string;
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
const ERROR_HOLD_MS = 900;

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
      setErrorMessage(err instanceof Error ? err.message : "Verification failed");
      setPhase("error");
      setTimeout(() => {
        if (runIdRef.current !== myRun) return;
        setPhase("input");
        resetDigits();
        setBackupCode("");
      }, ERROR_HOLD_MS);
    }
  }, [onVerify, onSuccess, resetDigits]);

  const handleDigitChange = (index: number, raw: string) => {
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
    setDigits((d) => {
      const next = [...d];
      next[index] = value;
      if (next.every((v) => v) && index === length - 1) {
        void runVerification(next.join(""));
      } else if (index < length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
      return next;
    });
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
              x: phase === "error" ? [0, -8, 8, -6, 6, -2, 2, 0] : 0,
            }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <div className="relative flex h-14 w-14 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-xl" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-teal/20 border border-white/10">
                  <ShieldCheck className="h-6 w-6 text-purple-300" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{title}</h2>
                <p className="mt-1 text-sm text-[#94A3B8]">{subtitle}</p>
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
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={`h-14 w-11 rounded-xl border bg-white/5 text-center text-xl font-semibold text-white outline-none transition-all focus:ring-2 ${
                      d
                        ? "border-purple-400/60 shadow-[0_0_16px_rgba(168,85,247,0.35)]"
                        : "border-white/10 focus:border-purple-400/60 focus:shadow-[0_0_16px_rgba(168,85,247,0.35)] focus:ring-purple-400/20"
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
                  onChange={(e) => setBackupCode(e.target.value)}
                  placeholder="Backup code"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm tracking-wide text-white placeholder:text-white/30 outline-none transition-all focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/20"
                />
                <button
                  type="submit"
                  disabled={!backupCode.trim()}
                  className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50"
                >
                  Verify
                </button>
              </form>
            )}

            {phase === "error" && (
              <p className="mt-4 text-center text-xs text-red-400">{errorMessage}</p>
            )}

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#94A3B8]">
              <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-300/70" />
              <span>{backupMode ? "Enter one of your saved backup codes" : tip}</span>
            </div>

            {allowBackupCode && (
              <button
                type="button"
                onClick={() => { setBackupMode((v) => !v); setErrorMessage(""); }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/60"
              >
                <KeyRound className="h-3 w-3" />
                {backupMode ? "Use authenticator code instead" : "Use a backup code instead"}
              </button>
            )}

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="mt-2 w-full text-center text-xs text-white/40 transition-colors hover:text-white/60"
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
            className="flex flex-col items-center gap-8 rounded-2xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-xl"
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
                        className="absolute left-1/2 top-1/2 flex h-9 w-9 items-center justify-center rounded-lg border border-purple-400/40 bg-white/10 text-sm font-semibold text-white shadow-[0_0_14px_rgba(168,85,247,0.4)]"
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
                    className="absolute h-28 w-28 rounded-full border-2 border-purple-400/50"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.3, 0.8] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute h-20 w-20 rounded-full border-2 border-teal/50"
                    animate={{ scale: [1, 1.25, 1], opacity: [0.9, 0.2, 0.9] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                  />
                  <div className="absolute h-12 w-12 rounded-full bg-purple-400/30 blur-lg" />
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
                    className="absolute inset-0 rounded-full bg-emerald-400/30 blur-xl"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.5)]">
                    <Check className="h-8 w-8 text-white" strokeWidth={3} />
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
                  className="text-lg font-bold text-white"
                >
                  {phase === "orbiting" && "Orbiting your code…"}
                  {phase === "verifying" && "Verifying your code…"}
                  {phase === "success" && successTitle}
                </motion.h2>
              </AnimatePresence>
              <p className="mt-1 text-sm text-[#94A3B8]">
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
