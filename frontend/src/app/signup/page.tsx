"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { Footer } from "@/components/layout/Footer";
import { AuthPageShell } from "@/components/ui/AuthPageShell";
import { AnimatedCheckbox } from "@/components/ui/AnimatedCheckbox";
import { UserPlus, ArrowLeft, User, Mail, Phone, AlertCircle, MailCheck } from "lucide-react";

const inputBase =
  "w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition-all focus:border-purple-400/60 focus:ring-2 focus:ring-purple-400/20 focus:shadow-[0_0_16px_rgba(168,85,247,0.25)]";

const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed";

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

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!agreedToTerms) {
      setError("Please agree to the Terms & Conditions to continue");
      return;
    }
    setIsPending(true);
    try {
      await signup(name.trim(), email.trim(), phone.trim());
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AuthPageShell
      icon={UserPlus}
      title={submitted ? "Check your inbox" : "Create an Account"}
      subtitle={submitted ? "We'll email you once your account is approved" : "Start your journey with us today"}
      footer={<Footer variant="dark" />}
    >
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="submitted"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="space-y-5 text-center"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative mx-auto flex h-14 w-14 items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-lg" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <MailCheck className="h-6 w-6 text-purple-300" />
              </div>
            </motion.div>
            <div>
              <p className="text-sm font-semibold text-white">Registration received</p>
              <p className="mt-2 text-sm text-[#94A3B8]">
                Your account is pending administrator approval. You&apos;ll receive an email with your login details once approved.
              </p>
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="button" onClick={() => router.push("/login")} className={primaryButton}>
              Back to sign in
            </motion.button>
          </motion.div>
        ) : (
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

            <AnimatedCheckbox
              id="agree-terms"
              checked={agreedToTerms}
              onChange={setAgreedToTerms}
              label={<>I agree to the Terms &amp; Conditions and Privacy Policy</>}
            />

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isPending || !name || !email || !phone} className={primaryButton}>
              {isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <UserPlus className="h-4 w-4" />}
              {isPending ? "Submitting…" : "Request Access"}
            </motion.button>

            <p className="text-center text-xs text-white/30">
              Your registration will be reviewed by an administrator before you can sign in.
            </p>

            <Link href="/login" className="flex items-center justify-center gap-1.5 text-xs text-white/40 transition-colors hover:text-white/60">
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </Link>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthPageShell>
  );
}
