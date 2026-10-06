"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

/** A page inside the signed-in app crashed: keep the app shell, offer a retry or a way back. */
export default function AppSectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[AppError]", error); }, [error]);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div role="alert" className="w-full max-w-md rounded-pp border border-pp-border bg-pp-surface p-6 text-center shadow-pp">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pp-critical/10 text-pp-critical"><AlertTriangle className="h-6 w-6" aria-hidden="true" /></div>
        <h1 className="text-lg font-bold text-pp-text">This page hit a problem</h1>
        <p className="mt-1 text-sm text-pp-text-dim">Your data is safe. Try again, or go back to the dashboard.</p>
        {error.digest && <p className="mt-2 text-xs text-pp-text-dim">Reference: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={reset} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-pp-accent px-4 text-sm font-semibold text-pp-accent-ink"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button>
          <Link href="/dashboard" className="inline-flex min-h-[44px] items-center rounded-xl border border-pp-border px-4 text-sm font-medium text-pp-text">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
