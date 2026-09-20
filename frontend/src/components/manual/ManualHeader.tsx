import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export function ManualHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-pp-border bg-pp-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/manual" className="flex min-w-0 items-center gap-2">
          <Image src="/logo.png" alt="Penny Pilot" width={28} height={28} className="h-7 w-7 shrink-0 rounded-lg object-cover" />
          <span className="truncate text-sm font-bold text-pp-text">
            Penny Pilot <span className="font-normal text-pp-text-dim">User Manual</span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            aria-label="Back to Penny Pilot"
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-pp-text-dim transition-colors hover:bg-pp-surface-2 hover:text-pp-text sm:px-3"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back to Penny Pilot</span>
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-pp-accent px-3 py-2 text-sm font-semibold text-pp-accent-ink transition-opacity hover:opacity-90 sm:px-4"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
