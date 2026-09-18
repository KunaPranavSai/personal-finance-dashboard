"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useSettingsContext } from "@/lib/SettingsContext";
import { playVoiceGreeting, isVoiceGreetingsEnabled } from "@/lib/voiceGreeting";
import { Footer } from "@/components/layout/Footer";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { AnimatedCheckbox } from "@/components/ui/AnimatedCheckbox";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { downloadConsentPdfFromBase64 } from "@/lib/consent";
import { UserPlus, ArrowLeft, User, Mail, Phone, Lock, AlertCircle, PenLine, CheckCircle2, Download } from "lucide-react";

const inputBase =
  "w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/20 focus:shadow-[0_0_16px_rgba(168,85,247,0.25)]";

const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed";

const secondaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed";

// Letters (incl. accented/Unicode), marks, spaces, hyphens, apostrophes, periods.
// Mirrors backend/src/routes/auth.routes.ts's SIGNATURE_NAME_PATTERN.
const SIGNATURE_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u;
const SIGNATURE_NAME_MAX = 150;

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={typeof children === "string" ? children : "error"}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto", x: [0, -6, 6, -4, 4, 0] }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.35 }}
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300"
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface ConfirmationState {
  signedName: string;
  acceptedAt: string;
  consentPdfBase64: string | null;
  email: string;
}

export function SignupPageClient() {
  const { signup } = useAuth();
  const { settings } = useSettingsContext();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [downloadState, setDownloadState] = useState<"idle" | "downloading" | "done" | "failed">("idle");

  // Auto-download once, right after the confirmation screen appears.
  useEffect(() => {
    if (!confirmation) return;
    if (confirmation.consentPdfBase64) {
      const ok = downloadConsentPdfFromBase64(confirmation.consentPdfBase64, confirmation.acceptedAt);
      setDownloadState(ok ? "done" : "failed");
    } else {
      setDownloadState("failed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmation !== null]);

  const trimmedSignature = signature.trim();
  const signatureValid =
    trimmedSignature.length > 0 && trimmedSignature.length <= SIGNATURE_NAME_MAX && SIGNATURE_NAME_PATTERN.test(trimmedSignature);
  const signatureTouched = signature.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!agreedToTerms) {
      setError("Please check the Terms of Service box to continue.");
      return;
    }
    if (!agreedToPrivacy) {
      setError("Please check the Privacy Policy box to continue.");
      return;
    }
    if (!signatureValid) {
      setError("Please type your full name as your electronic signature.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must be at least 8 characters and include a letter and a number");
      return;
    }
    setIsPending(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await signup({
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        password,
        termsAccepted: agreedToTerms,
        privacyAccepted: agreedToPrivacy,
        signedName: trimmedSignature,
      });
      setConfirmation({
        signedName: result.consent.signedName,
        acceptedAt: result.consent.acceptedAt,
        consentPdfBase64: result.consentPdfBase64,
        email: normalizedEmail,
      });
      // Speak only now that account creation has actually succeeded — never
      // on a failed signup (the catch block below never reaches this line).
      // No session exists yet at this point, so settings.preferences falls
      // back to the documented ON-by-default value automatically.
      playVoiceGreeting("signup", { enabled: isVoiceGreetingsEnabled(settings.preferences) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsPending(false);
    }
  };

  const handleManualDownload = async () => {
    if (!confirmation) return;
    if (confirmation.consentPdfBase64) {
      const ok = downloadConsentPdfFromBase64(confirmation.consentPdfBase64, confirmation.acceptedAt);
      setDownloadState(ok ? "done" : "failed");
      if (ok) return;
    }
    // Fall back to the authenticated endpoint only makes sense once logged in;
    // from this pre-login confirmation screen, retrying the base64 trigger is
    // the only option, so surface a clear message instead of a silent no-op.
    setDownloadState("failed");
  };

  if (confirmation) {
    return (
      <AuthPageShell
        icon={CheckCircle2}
        title="Account Created Successfully"
        subtitle="Your Terms of Service and Privacy Policy acceptance has been recorded."
        footer={<Footer variant="dark" />}
      >
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <p>
              <span className="text-white/50">Signed as:</span> <span className="font-medium text-white">{confirmation.signedName}</span>
            </p>
            <p className="mt-1">
              <span className="text-white/50">Accepted:</span>{" "}
              <span className="font-medium text-white">
                {new Date(confirmation.acceptedAt).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}
              </span>
            </p>
          </div>

          {downloadState === "failed" && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Your account was created successfully, but the automatic download didn&apos;t start. Use the button below,
              or download it again anytime after signing in from Profile.
            </p>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleManualDownload}
            className={secondaryButton}
          >
            <Download className="h-4 w-4" /> Download Signed Consent
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => router.push(`/login?registered=1&email=${encodeURIComponent(confirmation.email)}`)}
            className={primaryButton}
          >
            Continue to Sign In
          </motion.button>
        </motion.div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      icon={UserPlus}
      title="Create an Account"
      subtitle="Start your journey with us today"
      footer={<Footer variant="dark" />}
    >
      <AnimatePresence mode="wait">
        <motion.form
          key="form"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.25 }}
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div>
            <label htmlFor="name" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Full Name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
                autoFocus
                className={inputBase}
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={inputBase}
              />
            </div>
          </div>
          <div>
            <label htmlFor="phone" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Mobile Number
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters, letter + number"
                required
                className={inputBase}
                toggleClassName="text-white/30 hover:text-white/60"
              />
            </div>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                className={inputBase}
                toggleClassName="text-white/30 hover:text-white/60"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Consent</p>

            <AnimatedCheckbox
              id="agree-terms"
              checked={agreedToTerms}
              onChange={setAgreedToTerms}
              label={
                <>
                  I have read and agree to the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-purple-300 underline underline-offset-2 hover:text-purple-200"
                  >
                    Terms of Service
                  </Link>
                  .
                </>
              }
            />
            <AnimatedCheckbox
              id="agree-privacy"
              checked={agreedToPrivacy}
              onChange={setAgreedToPrivacy}
              label={
                <>
                  I have read and acknowledge the{" "}
                  <Link
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-purple-300 underline underline-offset-2 hover:text-purple-200"
                  >
                    Privacy Policy
                  </Link>
                  .
                </>
              }
            />

            <div className="pt-1">
              <label htmlFor="signature" className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                Electronic Signature
              </label>
              <p className="mb-2 text-xs text-white/40">
                By typing my full name below, I acknowledge that this name is my electronic signature/authorization
                for the acceptance recorded above. This is a typed electronic signature/authorization, not a
                cryptographic digital signature.
              </p>
              <div className="relative">
                <PenLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  id="signature"
                  type="text"
                  autoComplete="name"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Type your full name"
                  maxLength={SIGNATURE_NAME_MAX}
                  required
                  aria-invalid={signatureTouched && !signatureValid}
                  aria-describedby="signature-help"
                  className={inputBase}
                />
              </div>
              {signatureTouched && !signatureValid && (
                <p id="signature-help" className="mt-1 text-xs text-red-300">
                  Enter your full name (letters, spaces, hyphens, and apostrophes only).
                </p>
              )}
            </div>

            <p className="text-xs leading-relaxed text-white/40">
              By checking the boxes above and entering my full name as my electronic signature, I confirm that I
              have reviewed and agree to the Terms of Service and acknowledge the Privacy Policy.
            </p>
          </div>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={
              isPending ||
              !name ||
              !email ||
              !phone ||
              !password ||
              !confirmPassword ||
              !agreedToTerms ||
              !agreedToPrivacy ||
              !signatureValid
            }
            className={primaryButton}
          >
            {isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <UserPlus className="h-4 w-4" />}
            {isPending ? "Creating account…" : "Create Account"}
          </motion.button>

          <Link href="/login" className="flex items-center justify-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/60">
            <ArrowLeft className="h-3 w-3" /> Back to sign in
          </Link>
        </motion.form>
      </AnimatePresence>
    </AuthPageShell>
  );
}
