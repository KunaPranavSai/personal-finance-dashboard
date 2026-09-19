import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/format";

const FOOTER_LINKS = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Financial Intelligence", href: "#showcase" },
    { label: "Privacy & Security", href: "#privacy-security" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "FAQ", href: "#faq" },
  ],
  company: [{ label: "Contact", href: "mailto:superadminpennypilot@gmail.com" }],
  legal: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms of Service", href: "/terms" },
  ],
  account: [
    { label: "Log In", href: "/login" },
    { label: "Get Started", href: "/signup" },
  ],
};

export function LandingFooter() {
  return (
    <footer className="border-t border-black/5 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-navy-dark/70">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5 mb-10">
          {/* Brand column */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4" aria-label="Penny Pilot Home">
              <Image src="/logo.png" alt="Penny Pilot" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
              <span className="text-sm font-bold text-navy dark:text-white">Penny Pilot</span>
            </Link>
            <p className="text-sm text-navy/60 dark:text-white/60 mb-4">
              A personal finance dashboard for tracking income, expenses, budgets, bills, savings, and investments in one secure place.
            </p>
            <div className="flex items-center gap-2 text-sm text-navy/50 dark:text-white/50">
              <span>Designed and developed by Kuna Pranav Sai</span>
            </div>
          </div>

          {/* Product links */}
          <nav aria-label="Product">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-navy/50 dark:text-white/50 mb-4">Product</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={cn("text-sm text-navy/70 dark:text-white/70 transition-colors hover:text-teal")}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company links */}
          <nav aria-label="Company">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-navy/50 dark:text-white/50 mb-4">Company</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={cn("text-sm text-navy/70 dark:text-white/70 transition-colors hover:text-teal")}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal links */}
          <nav aria-label="Legal">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-navy/50 dark:text-white/50 mb-4">Legal</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={cn("text-sm text-navy/70 dark:text-white/70 transition-colors hover:text-teal")}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Account links */}
          <nav aria-label="Account">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-navy/50 dark:text-white/50 mb-4">Account</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.account.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                      link.href === "/signup"
                        ? "bg-teal text-white hover:bg-teal/90"
                        : "border border-navy/15 text-navy hover:bg-black/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-black/5 dark:border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-navy/40 dark:text-white/40">
              © {new Date().getFullYear()} Penny Pilot. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/privacy-policy"
                className="text-xs text-navy/50 dark:text-white/50 hover:text-teal transition-colors underline-offset-2 hover:underline"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-xs text-navy/50 dark:text-white/50 hover:text-teal transition-colors underline-offset-2 hover:underline"
              >
                Terms of Service
              </Link>
              <a
                href="mailto:superadminpennypilot@gmail.com"
                className="text-xs text-navy/50 dark:text-white/50 hover:text-teal transition-colors underline-offset-2 hover:underline"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}