import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/format";

const navLink =
  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors text-navy/60 hover:bg-black/5 hover:text-navy dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white";
const navLinkActive = "bg-teal/10 text-navy dark:bg-white/10 dark:text-white";

interface LegalPageShellProps {
  title: string;
  lastUpdated: string;
  active: "privacy" | "terms";
  children: React.ReactNode;
}

/**
 * Shared public-page shell for /privacy-policy and /terms — reuses the app's
 * "Midnight Cockpit" canvas (already painted by the root layout's body) and
 * the same glass Card language as the authenticated app, but as a plain
 * server-renderable page (no auth gate, no client state) since neither page
 * needs interactivity.
 */
export function LegalPageShell({ title, lastUpdated, active, children }: LegalPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-navy-dark/70">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/login" className="flex min-w-0 items-center gap-2">
            <Image src="/logo.png" alt="Penny Pilot" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            <span className="truncate text-sm font-bold text-navy dark:text-white">Penny Pilot</span>
          </Link>
          <nav aria-label="Legal pages" className="flex items-center gap-1">
            <Link href="/privacy-policy" className={cn(navLink, active === "privacy" && navLinkActive)}>
              Privacy Policy
            </Link>
            <Link href="/terms" className={cn(navLink, active === "terms" && navLinkActive)}>
              Terms of Service
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-navy dark:text-white sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-navy/50 dark:text-white/40">Last updated: {lastUpdated}</p>
        </div>

        <div
          className={cn(
            "rounded-xl2 border border-[rgba(199,210,254,0.7)] bg-white/[0.82] p-6 shadow-[0_10px_30px_-10px_rgba(79,70,229,0.08),0_4px_12px_-2px_rgba(0,0,0,0.03)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[rgba(15,23,42,0.75)] dark:shadow-card dark:backdrop-blur-xl sm:p-10",
            "prose-legal"
          )}
        >
          {children}
        </div>

        <p className="mt-8 text-center text-sm text-navy/50 dark:text-white/40">
          Questions about {active === "privacy" ? "this Privacy Policy" : "these Terms"}? See{" "}
          <Link href={active === "privacy" ? "/terms" : "/privacy-policy"} className="font-medium text-teal underline underline-offset-2 hover:opacity-80">
            {active === "privacy" ? "our Terms of Service" : "our Privacy Policy"}
          </Link>{" "}
          or the contact details below.
        </p>
      </main>

      <Footer />
    </div>
  );
}
