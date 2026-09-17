"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { useNotifications } from "@/lib/reference";
import { useKeyboardInset } from "./useKeyboardInset";
import { GlobalSearchSheet } from "./GlobalSearchSheet";
import { QuickActions } from "@/components/layout/QuickActions";

// Every destination is a real, normal Penny Pilot URL — each one renders
// responsively in place (desktop UI for desktop UAs, this mobile UI for
// phone UAs) from the same route, no separate route tree or rewrite.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: "⌂" },
  { href: "/transactions", label: "Activity", icon: "≡" },
  { href: "/budget", label: "Budget", icon: "◧" },
  { href: "/investments", label: "Invest", icon: "↗" },
  { href: "/more", label: "More", icon: "⋯" },
] as const;

interface MobileShellProps {
  title: string;
  /** Optional second line under the brand title — only Home passes this
   * (the "Smart Money Management" tagline); every other screen keeps its
   * existing single-line title untouched. */
  subtitle?: string;
  children: ReactNode;
}

/**
 * Shared chrome for every migrated mobile screen: sticky app bar + fixed
 * bottom nav. Mirrors the approved mobile artifact's composition exactly.
 * Renders inside the .pp-mobile scope established by (app)/layout.tsx's
 * mobile branch, so every color here comes from mobile.css's --ppm-*
 * tokens, never a literal.
 *
 * Search and Sync live here (not per-page) so every mobile screen gets both
 * consistently: Search opens a real global-search sheet (GlobalSearchSheet
 * — real pages + the user's own transactions, not a client-side stub), Sync
 * is the same "Storage & Sync" destination the old Home quick-actions row
 * used to link to, just relocated beside Search per the header layout.
 * QuickActions is mounted once here too, giving mobile the same FAB the
 * desktop Topbar already has — no duplicate implementation, same component.
 */
export function MobileShell({ title, subtitle, children }: MobileShellProps) {
  const pathname = usePathname();
  const { data: notifications } = useNotifications();
  const unreadCount = (notifications?.items ?? []).filter((n) => !n.read).length;
  const [searchOpen, setSearchOpen] = useState(false);
  // Hide the fixed bottom nav while the on-screen keyboard is open (e.g.
  // typing in the full-page Profile form) instead of letting it float in
  // the wrong place or get covered — the standard mobile pattern, and
  // simpler/less jarring than repositioning a whole tab bar mid-keystroke.
  const keyboardInset = useKeyboardInset();

  return (
    <div className="ppm-shell">
      <header className="ppm-appbar">
        <div className="ppm-brand">
          {/* Same /logo.png already used by the desktop Sidebar/AdminSidebar
              brand mark — reused here instead of the placeholder "PP" text. */}
          <Image src="/logo.png" alt="Penny Pilot" width={36} height={36} className="mark" style={{ objectFit: "cover" }} />
          {subtitle ? (
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
              <span>{title}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ppm-text-dim)", letterSpacing: ".01em" }}>{subtitle}</span>
            </span>
          ) : (
            <span>{title}</span>
          )}
        </div>
        <div className="ppm-actions">
          <button type="button" className="ppm-iconbtn" aria-label="Search" onClick={() => setSearchOpen(true)}>
            ⌕
          </button>
          <Link href="/settings/storage" className="ppm-iconbtn" aria-label="Sync" title="Sync">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
              <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
              <path d="M3 21v-5h5" />
              <path d="M21 3v5h-5" />
            </svg>
          </Link>
          <Link href="/notifications" className="ppm-iconbtn" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}>
            🔔
            {unreadCount > 0 && <span className="ppm-dot" />}
          </Link>
        </div>
      </header>

      <main className="ppm-main">{children}</main>

      <nav className="ppm-bottomnav" aria-label="Primary" style={keyboardInset > 0 ? { display: "none" } : undefined}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`ppm-navbtn${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="ic" aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <GlobalSearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickActions />
    </div>
  );
}
