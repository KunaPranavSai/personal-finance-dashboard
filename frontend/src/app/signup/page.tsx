"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import { Footer } from "@/components/layout/Footer";
import { Shield, UserPlus, ArrowLeft } from "lucide-react";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-[#0a1628] to-slate-900 p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-teal/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="Penny Pilot" width={64} height={64} className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-teal/25" />
          <div>
            <h1 className="text-2xl font-bold text-white">Create your account</h1>
            <p className="mt-1 text-sm text-white/50">Sign up to start tracking your finances</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
          {submitted ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal/10">
                <UserPlus className="h-6 w-6 text-teal" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Registration received</p>
                <p className="mt-2 text-sm text-white/50">
                  Your account is pending administrator approval. You&apos;ll receive an email with your login details once approved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                  Mobile Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
                  <Shield className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || !name || !email || !phone}
                className="w-full rounded-xl bg-gradient-to-r from-teal to-teal/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:from-teal/90 hover:to-teal/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Request Access
                  </>
                )}
              </button>

              <p className="text-center text-xs text-white/30">
                Your registration will be reviewed by an administrator before you can sign in.
              </p>

              <Link href="/login" className="flex items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors">
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </Link>
            </form>
          )}
        </div>

        <Footer variant="dark" />
      </div>
    </div>
  );
}
