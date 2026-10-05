"use client";

import { FormEvent, ReactNode, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Bell } from "lucide-react";
import { MobileSheet } from "@/components/mobile/MobileSheet";
import { useKeyboardInset } from "@/components/mobile/useKeyboardInset";
import { useToast } from "@/components/ui/Toast";
import "@/styles/admin-command-center.css";

// Five tabs, same pattern as the user app. Each tab owns a group of admin routes.
const TABS = [
  { href: "/admin", label: "Overview", icon: "⌂", match: ["/admin"], exact: true },
  { href: "/admin/users", label: "Users", icon: "≡", match: ["/admin/users"] },
  { href: "/admin/system-health", label: "System", icon: "◧", match: ["/admin/system-health", "/admin/migration", "/admin/activity"] },
  { href: "/admin/announcements", label: "Content", icon: "↗", match: ["/admin/announcements", "/admin/email-templates", "/admin/automated-emails", "/admin/email"] },
  { href: "/admin/more", label: "More", icon: "⋯", match: ["/admin/more", "/admin/settings", "/admin/integrations", "/admin/account", "/admin/sessions"] },
] as const;

/**
 * Phone chrome for the admin console: the same app bar + bottom navigation as the user app, with the admin
 * pages rendered inside. `pp-mobile dark` supplies the shared tokens; `cc-root` keeps the console's own palette
 * for the page bodies so existing admin pages render unchanged.
 */
export function AdminMobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const keyboardInset = useKeyboardInset();
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

  // Refresh = re-fetch the data behind the current screen. It never navigates anywhere.
  const refresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" }, { throwOnError: true });
    } catch {
      toast("Couldn't refresh. Tap refresh to try again.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSearchOpen(false);
    router.push(`/admin/users?q=${encodeURIComponent(q.trim())}`);
  };

  const isActive = (t: (typeof TABS)[number]) =>
    "exact" in t && t.exact ? pathname === t.href : t.match.some((m) => pathname === m || pathname.startsWith(m + "/"));

  return (
    <div className="pp-mobile dark ppm-shell">
      <header className="ppm-appbar">
        <div className="ppm-brand">
          <Link href="/admin" aria-label="Admin overview" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Image src="/logo.png" alt="" width={36} height={36} className="mark" style={{ borderRadius: 10 }} />
            <span>Admin Console</span>
          </Link>
        </div>
        <div className="ppm-actions">
          <button type="button" className="ppm-iconbtn" aria-label="Search users" onClick={() => setSearchOpen(true)}>
            <Search size={18} aria-hidden="true" />
          </button>
          <button type="button" className="ppm-iconbtn" aria-label={refreshing ? "Refreshing" : "Refresh"} title="Refresh" aria-busy={refreshing} disabled={refreshing} onClick={refresh}>
            <svg className={refreshing ? "ppm-spin" : undefined} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
              <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
              <path d="M3 21v-5h5" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <Link href="/admin/activity" className="ppm-iconbtn" aria-label="Recent activity">
            <Bell size={18} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="ppm-main">
        <div className="cc-root dark ppm-admin-content" style={{ minHeight: 0, background: "transparent", margin: "0 -16px" }}>{children}</div>
      </main>

      <nav className="ppm-bottomnav" aria-label="Admin" style={keyboardInset > 150 ? { display: "none" } : undefined}>
        {TABS.map((t) => {
          const active = isActive(t);
          return (
            <Link key={t.href} href={t.href} className={`ppm-navbtn${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="ic" aria-hidden="true">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </nav>

      <MobileSheet open={searchOpen} onClose={() => setSearchOpen(false)} title="Search users">
        <form onSubmit={submitSearch}>
          <div className="ppm-field">
            <label htmlFor="admin-q">Name, email or UID</label>
            <input id="admin-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search required" />
          </div>
          <div className="ppm-sheet-actions">
            <button type="submit" className="ppm-sheet-submit" disabled={!q.trim()}>Search</button>
            <button type="button" className="ppm-sheet-cancel" onClick={() => setSearchOpen(false)}>Cancel</button>
          </div>
        </form>
      </MobileSheet>
    </div>
  );
}
