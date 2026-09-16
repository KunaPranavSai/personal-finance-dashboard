"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useNotifications } from "@/lib/reference";
import { useKeyboardInset } from "./useKeyboardInset";

// Bare, normal Penny Pilot URLs — the middleware (src/middleware.ts) rewrites
// these transparently to their /m/* implementation for phone-class user
// agents, so the address bar never needs to show "/m/..." during ordinary
// navigation. "/m/more" has no bare equivalent (More is a mobile-only
// concept with no single desktop page behind it) so it keeps its /m/ path.
const NAV_ITEMS = [
  { href: "/dashboard", mobileHref: "/m/dashboard", label: "Home", icon: "⌂" },
  { href: "/transactions", mobileHref: "/m/transactions", label: "Activity", icon: "≡" },
  { href: "/budget", mobileHref: "/m/budget", label: "Budget", icon: "◧" },
  { href: "/investments", mobileHref: "/m/investments", label: "Invest", icon: "↗" },
  { href: "/m/more", mobileHref: "/m/more", label: "More", icon: "⋯" },
] as const;

interface MobileShellProps {
  title: string;
  children: ReactNode;
  onSearchClick?: () => void;
}

/**
 * Shared chrome for every /m/* screen: sticky app bar + fixed bottom nav.
 * Mirrors the approved mobile artifact's composition exactly. Renders inside
 * the .pp-mobile scope established by app/m/layout.tsx, so every color here
 * comes from mobile.css's --ppm-* tokens, never a literal.
 */
export function MobileShell({ title, children, onSearchClick }: MobileShellProps) {
  const pathname = usePathname();
  const { data: notifications } = useNotifications();
  const unreadCount = (notifications?.items ?? []).filter((n) => !n.read).length;
  // Hide the fixed bottom nav while the on-screen keyboard is open (e.g.
  // typing in the full-page Profile form) instead of letting it float in
  // the wrong place or get covered — the standard mobile pattern, and
  // simpler/less jarring than repositioning a whole tab bar mid-keystroke.
  const keyboardInset = useKeyboardInset();

  return (
    <div className="ppm-shell">
      <header className="ppm-appbar">
        <div className="ppm-brand">
          <span className="mark">PP</span>
          <span>{title}</span>
        </div>
        <div className="ppm-actions">
          <button type="button" className="ppm-iconbtn" aria-label="Search" onClick={onSearchClick}>
            ⌕
          </button>
          <Link href="/notifications" className="ppm-iconbtn" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}>
            🔔
            {unreadCount > 0 && <span className="ppm-dot" />}
          </Link>
        </div>
      </header>

      <main className="ppm-main">{children}</main>

      <nav className="ppm-bottomnav" aria-label="Primary" style={keyboardInset > 0 ? { display: "none" } : undefined}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname === item.mobileHref;
          return (
            <Link key={item.href} href={item.href} className={`ppm-navbtn${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="ic" aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
