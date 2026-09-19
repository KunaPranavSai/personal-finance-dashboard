"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Download } from "lucide-react";
import { cn } from "@/lib/format";
import { isPwaInstalled, canPromptInstall, triggerInstallPrompt, subscribeToInstallAvailability } from "@/lib/pwaInstall";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Privacy & Security", href: "#privacy-security" },
  { label: "Google Drive", href: "#google-drive" },
  { label: "FAQ", href: "#faq" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkInstall = () => {
      setIsInstalled(isPwaInstalled());
      setCanInstall(canPromptInstall());
    };
    checkInstall();

    const unsubscribe = subscribeToInstallAvailability(checkInstall);
    return unsubscribe;
  }, []);

  const handleInstallClick = async () => {
    if (!canInstall) return;
    const result = await triggerInstallPrompt();
    if (result === "accepted") {
      setIsInstalled(true);
      setCanInstall(false);
    }
  };

  const scrollToSection = (href: string) => {
    if (href.startsWith("#")) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        setMobileMenuOpen(false);
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-navy-dark/70">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" aria-label="Penny Pilot Home">
            <Image src="/logo.png" alt="Penny Pilot" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            <span className="text-sm font-bold text-navy dark:text-white">Penny Pilot</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-8">
            <div className="flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    if (link.href.startsWith("#")) {
                      e.preventDefault();
                      scrollToSection(link.href);
                    }
                  }}
                  className="text-sm font-medium text-navy/70 dark:text-white/70 transition-colors hover:text-teal"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-3 ml-4 border-l border-black/10 dark:border-white/10 pl-4">
              {/* Install App Button */}
              {(canInstall && !isInstalled) && (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-all hover:bg-navy-dark",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
                  )}
                  aria-label="Install Penny Pilot as an app"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Install App</span>
                </button>
              )}
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy/70 transition-colors hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5 hidden sm:block"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-teal px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Get Started
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-navy/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <motion.div
          id="mobile-menu"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: mobileMenuOpen ? 1 : 0, height: mobileMenuOpen ? "auto" : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className={cn("md:hidden overflow-hidden border-t border-black/5 dark:border-white/10", mobileMenuOpen && "py-4")}
        >
          <div className="flex flex-col gap-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={(e) => {
                  if (link.href.startsWith("#")) {
                    e.preventDefault();
                    scrollToSection(link.href);
                  }
                }}
                className="px-2 py-3 text-base font-medium text-navy/70 dark:text-white/70 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-col gap-2">
              {(canInstall && !isInstalled) && (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-navy-dark",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
                  )}
                  aria-label="Install Penny Pilot as an app"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Install App
                </button>
              )}
              <Link
                href="/login"
                className="w-full rounded-lg border border-navy/15 bg-white/60 px-4 py-2.5 text-sm font-semibold text-navy text-center transition-colors hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white text-center transition-opacity hover:opacity-90"
              >
                Get Started
              </Link>
            </div>
          </div>
        </motion.div>
      </nav>
    </header>
  );
}