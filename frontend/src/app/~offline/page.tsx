import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = { title: "You're offline — Penny Pilot" };

/**
 * Precached by the service worker (next.config.ts `fallbacks.document`) and
 * served whenever a page navigation fails with no network and no cached
 * match — e.g. a route the user never visited while online.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-6 text-center dark:bg-navy-dark">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal/10">
        <WifiOff className="h-8 w-8 text-teal" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-navy dark:text-white">You&apos;re offline</h1>
        <p className="mt-1 max-w-xs text-sm text-navy/60 dark:text-white/60">
          This page hasn&apos;t been loaded before, so it isn&apos;t available offline. Pages you&apos;ve
          already visited — like your Dashboard — still work without a connection.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal/90"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
