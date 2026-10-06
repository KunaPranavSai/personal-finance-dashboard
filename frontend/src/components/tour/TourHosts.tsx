"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Compass } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Tour } from "./Tour";
import { isTourDone, markTourDone, ONBOARDING_STEPS, WELCOME_STEPS } from "./tours";

/**
 * Onboarding tour for signed-in users. Starts after the first sign-in (the app already sends new accounts to
 * /dashboard?welcome=1) and whenever someone replays it from Help & Support (/dashboard?tour=onboarding). A finished or
 * skipped tour is remembered per account in this browser, so it does not keep coming back by itself.
 */
function Onboarding() {
  const { user } = useAuth();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [want, setWant] = useState(false);
  const [open, setOpen] = useState(false);
  const uid = user?.uid;
  const replay = params.get("tour") === "onboarding";
  const first = params.get("welcome") === "1";

  useEffect(() => {
    if (!uid || user?.role !== "USER" || user.supervised) return;
    if (replay || (first && !isTourDone("onboarding", uid))) setWant(true);
  }, [uid, user?.role, user?.supervised, replay, first]);

  // Don't talk over other things a brand-new user must deal with first (PIN setup, cookie choice, any dialog).
  useEffect(() => {
    if (!want || open) return;
    const blocked = () => Boolean(document.querySelector('[role="dialog"]:not(.pp-tour *), [role="alertdialog"], [aria-label="Cookie notice"]'));
    const t = window.setInterval(() => { if (!blocked()) { setOpen(true); setWant(false); } }, 700);
    return () => window.clearInterval(t);
  }, [want, open]);

  const close = (reason: "done" | "skipped") => {
    setOpen(false);
    setWant(false);
    markTourDone("onboarding", uid, reason);
    if (replay || first) router.replace(pathname ?? "/dashboard");
    window.dispatchEvent(new CustomEvent("pp:tour-closed", { detail: { tour: "onboarding", reason } }));
  };
  return <Tour steps={ONBOARDING_STEPS} open={open} onClose={close} />;
}

export function OnboardingTourHost() {
  return <Suspense fallback={null}><Onboarding /></Suspense>;
}

/** "Take a Tour" button + the public Welcome tour (also opens from /?tour=welcome). Shows no account data. */
function Welcome() {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (params.get("tour") === "welcome") setOpen(true); }, [params]);
  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/15 px-6 text-sm font-semibold text-pp-text transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent"
      >
        <Compass className="h-4 w-4" aria-hidden="true" /> Take a Tour
      </button>
      <Tour steps={WELCOME_STEPS} open={open} onClose={(r) => { setOpen(false); markTourDone("welcome", undefined, r); }} onRestart={() => setOpen(true)} />
    </>
  );
}

export function TakeTourButton() {
  return <Suspense fallback={null}><Welcome /></Suspense>;
}
