"use client";

import { isValidPhone, pinProblem } from "@/lib/zodHelpers";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { STEP_UP_EVENT } from "@/lib/stepUp";
import { AnimatedCodeVerification } from "@/components/ui/AnimatedCodeVerification";
import { useToast } from "@/components/ui/Toast";

/**
 * Opens when an explorer first tries to save something (see lib/stepUp.ts): step 1 verify the email with a
 * 6-digit code, step 2 name + phone + terms. Mounted once in the app shell.
 */
export function StepUpHost() {
  const { user, sendEmailCode, verifyEmailCode, completeProfile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const sentFor = useRef<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", pin: "", pin2: "", terms: false, privacy: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const stage: "email" | "profile" | null =
    user?.role !== "USER" ? null : user.emailVerified === false ? "email" : user.profileCompleted === false ? "profile" : null;

  useEffect(() => {
    const onStepUp = () => setOpen(true);
    window.addEventListener(STEP_UP_EVENT, onStepUp);
    return () => window.removeEventListener(STEP_UP_EVENT, onStepUp);
  }, []);

  // Send the code once per opening of the email step.
  useEffect(() => {
    if (!open || stage !== "email" || sentFor.current === user?.email) return;
    sentFor.current = user?.email ?? null;
    sendEmailCode().catch((e) => toast((e as Error).message, "error"));
  }, [open, stage, user?.email, sendEmailCode, toast]);

  if (!open || !stage) return null;

  const close = () => { setOpen(false); sentFor.current = null; };
  const shell = "fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-pp-bg p-4";

  if (stage === "email") {
    return (
      <div className={shell} role="dialog" aria-modal="true" aria-label="Verify your email">
        <div className="flex w-full max-w-sm flex-col gap-3">
          <AnimatedCodeVerification
            length={6}
            title="Verify your email"
            subtitle={`To save your data, enter the 6-digit code we sent to ${user?.email}`}
            tip="Didn't get it? Check spam, or resend below"
            successTitle="Email verified!"
            successSubtitle="One more step…"
            onVerify={async (code) => { await verifyEmailCode(code); }}
          />
          <button type="button" className="min-h-[48px] rounded-xl border border-pp-border bg-pp-surface-2 px-4 text-sm font-medium text-pp-text hover:bg-pp-chip-bg"
            onClick={() => { sentFor.current = null; sendEmailCode().then(() => toast("Code sent", "success")).catch((e) => toast((e as Error).message, "error")); }}>
            Resend code
          </button>
          <button type="button" className="min-h-[48px] rounded-xl px-4 text-sm font-medium text-pp-text-dim hover:text-pp-text" onClick={close}>Not now</button>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const name = form.name.trim();
      if (!name) throw new Error("Enter your full name.");
      if (name.length > 150 || !/^[\p{L}][\p{L}\s.'’-]*$/u.test(name)) throw new Error("Use your real name: letters, spaces, dots, hyphens and apostrophes only.");
      if (!form.phone.trim()) throw new Error("Enter your phone number.");
      if (!isValidPhone(form.phone)) throw new Error("Enter a phone number with 7 to 15 digits. A leading + is fine.");
      if (form.pin || form.pin2) {
        const weak = pinProblem(form.pin);
        if (weak) throw new Error(weak);
        if (form.pin !== form.pin2) throw new Error("The two PINs don't match. Re-enter the same PIN in both boxes.");
      }
      if (!form.terms || !form.privacy) throw new Error("Please accept the Terms of Service and the Privacy Policy to continue.");
      await completeProfile({ name: form.name, phone: form.phone, pin: form.pin, termsAccepted: form.terms, privacyAccepted: form.privacy, signedName: form.name });
      for (const k of ["activity-feed", "capital-summary", "dashboard-summary"]) qc.invalidateQueries({ queryKey: [k] });
      toast("You're all set. Choose where to keep your data next.", "success");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  };
  const field = "w-full rounded-xl border border-pp-border bg-pp-surface-2 px-4 py-3 text-sm text-pp-text placeholder-pp-text-dim outline-none focus:border-pp-accent";
  return (
    <div className={shell} role="dialog" aria-modal="true" aria-label="Complete your profile">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-pp-border bg-pp-surface-2 p-5 backdrop-blur" noValidate>
        <div>
          <h2 className="text-lg font-bold text-pp-text">Almost there</h2>
          <p className="mt-1 text-sm text-pp-text-dim">Tell us a little about yourself to start saving your data.</p>
        </div>
        <input aria-label="Full name" className={field} placeholder="Full name required" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label="Phone number" className={field} placeholder="Phone number required" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <PasswordInput aria-label="Create a 4-digit PIN (optional)" className={field} inputMode="numeric" autoComplete="off" placeholder="4-digit PIN (optional)" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })} />
        <PasswordInput aria-label="Confirm PIN" className={field} inputMode="numeric" autoComplete="off" placeholder="Confirm PIN (optional)" value={form.pin2} onChange={(e) => setForm({ ...form, pin2: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })} />
        <label className="flex min-h-[44px] items-start gap-3 text-sm text-pp-text">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })} />
          <span>I accept the <a href="/terms" target="_blank" rel="noreferrer" className="text-pp-accent underline">Terms of Service</a></span>
        </label>
        <label className="flex min-h-[44px] items-start gap-3 text-sm text-pp-text">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.checked })} />
          <span>I have read the <a href="/privacy-policy" target="_blank" rel="noreferrer" className="text-pp-accent underline">Privacy Policy</a>. Typing my name above is my electronic signature.</span>
        </label>
        {error && <p role="alert" className="text-sm text-pp-critical">{error}</p>}
        <button type="submit" disabled={busy || !form.name.trim() || !form.phone.trim() || form.pin.length !== form.pin2.length || (form.pin.length > 0 && form.pin.length !== 4) || !form.terms || !form.privacy} className="min-h-[48px] w-full rounded-xl bg-pp-accent px-4 text-sm font-semibold text-pp-accent-ink hover:opacity-90 disabled:opacity-50">
          {busy ? "Saving…" : "Continue"}
        </button>
        <button type="button" className="min-h-[44px] w-full text-sm text-pp-text-dim hover:text-pp-text" onClick={close}>Not now</button>
      </form>
    </div>
  );
}
