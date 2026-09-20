"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/format";
import { InstallAppButton } from "./InstallAppButton";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
  { label: "Support", href: "#support" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    element?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-pp-border bg-pp-surface/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <Link href="/" className="flex items-center gap-2" aria-label="Penny Pilot Home">
          <Image src="/logo.png" alt="Penny Pilot" width={28} height={28} className="h-7 w-7 shrink-0 rounded-lg object-cover" />
          <span className="text-sm font-bold text-pp-text">Penny Pilot</span>
        </Link>

        <div className="hidden md:flex md:items-center md:gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
              className="text-sm font-medium text-pp-text-dim transition-colors hover:text-pp-accent"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <InstallAppButton variant="header" />
          <Link
            href="/login"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-pp-text-dim transition-colors hover:bg-pp-surface-2 hover:text-pp-text"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-pp-accent px-4 py-2 text-sm font-semibold text-pp-accent-ink transition-opacity hover:opacity-90"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-pp-text-dim hover:bg-pp-surface-2 md:hidden"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <div
        id="mobile-menu"
        className={cn(
          "overflow-hidden border-t border-pp-border transition-[max-height] duration-200 md:hidden",
          mobileMenuOpen ? "max-h-96 py-4" : "max-h-0"
        )}
      >
        <div className="flex flex-col gap-1 px-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
              className="min-h-[44px] rounded-lg px-2 py-3 text-base font-medium text-pp-text-dim transition-colors hover:bg-pp-surface-2 hover:text-pp-text"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-pp-border pt-3">
            <InstallAppButton variant="header-mobile" />
            <Link
              href="/login"
              className="w-full rounded-xl border border-pp-border px-4 py-2.5 text-center text-sm font-semibold text-pp-text transition-colors hover:bg-pp-surface-2"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="w-full rounded-xl bg-pp-accent px-4 py-2.5 text-center text-sm font-semibold text-pp-accent-ink transition-opacity hover:opacity-90"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
