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
    <header className="sticky top-3 z-50 px-3 sm:px-6">
      <nav
        className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-white/10 bg-noturno/60 px-3 pl-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
        aria-label="Main navigation"
      >
        <Link href="/" className="flex items-center gap-2" aria-label="Penny Pilot Home">
          <Image src="/logo.png" alt="Penny Pilot" width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" />
          <span className="text-sm font-bold text-pp-text">Penny Pilot</span>
        </Link>

        <div className="hidden md:flex md:items-center md:gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
              className="text-sm font-medium text-pp-text-dim transition-colors hover:text-pp-text"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <InstallAppButton variant="header" />
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-pp-text-dim transition-colors hover:bg-white/10 hover:text-pp-text"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-pp-accent px-5 py-2 text-sm font-semibold text-pp-accent-ink transition-[filter] hover:brightness-110"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="rounded-full p-2 text-pp-text-dim hover:bg-white/10 md:hidden"
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
          "mx-auto mt-2 max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-noturno/90 backdrop-blur-xl transition-[max-height,opacity] duration-300 md:hidden",
          mobileMenuOpen ? "max-h-[28rem] py-4 opacity-100" : "max-h-0 border-transparent opacity-0"
        )}
      >
        <div className="flex flex-col gap-1 px-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
              className="min-h-[44px] rounded-2xl px-3 py-3 text-base font-medium text-pp-text-dim transition-colors hover:bg-white/10 hover:text-pp-text"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
            <InstallAppButton variant="header-mobile" />
            <Link
              href="/login"
              className="w-full rounded-full border border-white/15 px-4 py-2.5 text-center text-sm font-semibold text-pp-text transition-colors hover:bg-white/10"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="w-full rounded-full bg-pp-accent px-4 py-2.5 text-center text-sm font-semibold text-pp-accent-ink transition-[filter] hover:brightness-110"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
