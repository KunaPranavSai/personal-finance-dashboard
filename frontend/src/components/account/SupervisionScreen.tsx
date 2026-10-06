"use client";

import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";

/**
 * Full-screen notice for an account a Super Admin has placed under supervision. It is a presentation layer only: the API
 * already refuses every data and settings request for this account. There is deliberately no sign-out or other way
 * out here. The screen checks quietly every 20 seconds and reloads the app once supervision has been lifted.
 */
export function SupervisionScreen() {
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await api.get<{ user?: { supervised?: boolean } }>("/api/auth/me");
        if (r.user && !r.user.supervised) window.location.reload();
      } catch { /* keep the lock in place */ }
    }, 20_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[10000] overflow-hidden bg-stone-200" role="alertdialog" aria-modal="true" aria-labelledby="sup-title" aria-describedby="sup-desc">
      {/* A frosted impression of the app behind the notice (the real pages are not loaded: the API refuses them). */}
      <div aria-hidden="true" className="absolute inset-0 select-none opacity-90" style={{ filter: "blur(14px) saturate(1.1)", transform: "scale(1.06)" }}>
        <div className="mx-auto max-w-xl space-y-3 p-5">
          <div className="h-14 rounded-2xl bg-white shadow-lg" />
          <div className="h-40 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-300 shadow-lg" />
          <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-white shadow-lg" />)}</div>
          <div className="h-32 rounded-2xl bg-white shadow-lg" />
          <div className="h-32 rounded-2xl bg-white shadow-lg" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-16 bg-teal-800" />
      </div>
      <div className="absolute inset-0 bg-white/30 backdrop-blur-xl dark:bg-black/40" />
      <div className="relative flex h-full items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-white/40 bg-white/70 p-7 text-center shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-black/50">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-600"><ShieldAlert size={28} aria-hidden="true" /></div>
          <h1 id="sup-title" className="text-xl font-extrabold uppercase tracking-wide text-pp-text">User is under<br />administrator control</h1>
          <p id="sup-desc" className="mt-3 text-sm leading-relaxed text-pp-text-dim">
            Your account is currently under Super Admin supervision.
            <br /><br />
            You can access Penny Pilot again once administrator supervision has been revoked.
          </p>
        </div>
      </div>
    </div>
  );
}
