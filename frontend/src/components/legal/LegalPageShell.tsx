import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/format";

const navLink =
  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors text-pp-text-dim hover:bg-pp-surface-2 hover:text-pp-text/60 dark:hover:text-white";
const navLinkActive = "bg-pp-accent/10 text-pp-text dark:bg-white/10 ";

interface LegalPageShellProps {
  title: string;
  lastUpdated: string;
  version?: string;
  active: "privacy" | "terms" | "cookies";
  children: React.ReactNode;
}

/**
 * Shared public-page shell for /privacy-policy and /terms — reuses the app's
 * pp-* canvas (already painted by the root layout's body) and the same
 * card language as the authenticated app, but as a plain
 * server-renderable page (no auth gate, no client state) since neither page
 * needs interactivity.
 */
export function LegalPageShell({ title, lastUpdated, version, active, children }: LegalPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-pp-border bg-pp-surface/70 backdrop-blur-xl dark:bg-pp-surface/70">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/login" className="flex min-w-0 items-center gap-2">
            <Image src="/logo.png" alt="Penny Pilot" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            <span className="truncate text-sm font-bold text-pp-text">Penny Pilot</span>
          </Link>
          <nav aria-label="Legal pages" className="flex items-center gap-1">
            <Link href="/privacy-policy" className={cn(navLink, active === "privacy" && navLinkActive)}>
              Privacy Policy
            </Link>
            <Link href="/terms" className={cn(navLink, active === "terms" && navLinkActive)}>
              Terms of Service
            </Link>
            <Link href="/cookie-notice" className={cn(navLink, active === "cookies" && navLinkActive)}>
              Cookie Notice
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-pp-text sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-pp-text-dim ">
            {version && <>Version {version} · </>}Last updated: {lastUpdated}
            <span className="ml-2 rounded-full bg-pp-accent/10 px-2 py-0.5 text-xs font-medium text-pp-accent">Official document</span>
          </p>
        </div>

        <div
          className={cn(
            "rounded-xl2 border border-pp-border bg-pp-surface p-6 shadow-pp backdrop-blur-2xl sm:p-10",
            "prose-legal"
          )}
        >
          {children}

          {active !== "cookies" && (
            <div className="mt-10 border-t border-pp-border pt-6 ">
              <h2>Acceptance &amp; Electronic Authorization</h2>
              <p>
                Acceptance of this document is recorded during account creation, through the required Terms of
                Service and Privacy Policy consent checkboxes and a typed electronic signature/authorization on the
                signup page — not by viewing this page on its own. If you have not yet created an account, you can{" "}
                <Link href="/signup" className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80">
                  return to signup
                </Link>{" "}
                to review and accept.
              </p>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-pp-text-dim ">
          Questions about {active === "privacy" ? "this Privacy Policy" : active === "terms" ? "these Terms" : "this Cookie Notice"}? See{" "}
          <Link href="/privacy-policy" className="font-medium text-pp-accent underline underline-offset-2 hover:opacity-80">
            our Privacy Policy
          </Link>{" "}
          or the contact details below.
        </p>
      </main>

      <Footer />
    </div>
  );
}
