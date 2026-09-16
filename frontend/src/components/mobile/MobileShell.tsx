"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useNotifications } from "@/lib/reference";
import { useKeyboardInset } from "./useKeyboardInset";

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
  children: ReactNode;
  onSearchClick?: () => void;
}

/**
 * Shared chrome for every migrated mobile screen: sticky app bar + fixed
 * bottom nav. Mirrors the approved mobile artifact's composition exactly.
 * Renders inside the .pp-mobile scope established by (app)/layout.tsx's
 * mobile branch, so every color here comes from mobile.css's --ppm-*
 * tokens, never a literal.
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
          const active = pathname === item.href;
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
