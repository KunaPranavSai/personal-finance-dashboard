"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import {
  Activity, FileText, HardDrive, LayoutDashboard, LogOut, Mail, Megaphone, Menu, Moon, RefreshCw, Search,
  Send, Settings, ShieldCheck, Sun, UserCircle, Users, X, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/admin/ui";
import "@/styles/admin.css";

interface NavItem { href: string; label: string; icon: LucideIcon }
const NAV: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Accounts", items: [{ href: "/admin/users", label: "Users", icon: Users }] },
  { label: "Security", items: [{ href: "/admin/activity", label: "Security & Audit", icon: ShieldCheck }] },
  {
    label: "Email & Messaging",
    items: [
      { href: "/admin/automated-emails", label: "Email Automations", icon: Mail },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/email", label: "Send Email", icon: Send },
    ],
  },
  { label: "Data", items: [{ href: "/admin/migration", label: "Migration", icon: HardDrive }] },
  { label: "System", items: [{ href: "/admin/system-health", label: "Health & Integrations", icon: Activity }] },
  {
    label: "Administration",
    items: [
      { href: "/admin/settings", label: "System Settings", icon: Settings },
      { href: "/admin/account", label: "My Account", icon: UserCircle },
      { href: "/admin/sessions", label: "My Sessions", icon: FileText },
    ],
  },
];
// Phones get five bottom tabs; everything else is one tap away in the menu.
const BOTTOM: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/activity", label: "Security", icon: ShieldCheck },
  { href: "/admin/automated-emails", label: "Email", icon: Mail },
];

const THEME_KEY = "pp-admin-theme";
type Theme = "light" | "dark" | undefined;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const fetching = useIsFetching() > 0;
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(undefined);
  const [q, setQ] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => { try { const t = localStorage.getItem(THEME_KEY); if (t === "light" || t === "dark") setTheme(t); } catch { /* storage unavailable */ } }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const effective = (): "light" | "dark" => theme ?? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const toggleTheme = () => {
    const next = effective() === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
  };
  const isActive = useCallback((href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/")), [pathname]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/admin/users?q=${encodeURIComponent(q.trim())}`);
  };
  // Refresh only re-fetches this console's own data; it never touches a user's Drive.
  const refresh = () => void queryClient.refetchQueries({ type: "active" });
  const signOut = async () => {
    setLoggingOut(true);
    await logout();
    window.location.href = "/admin-login"; // full reload clears every in-memory cache
  };

  return (
    <div className="ad-root" data-theme={theme}>
      <a href="#ad-main" className="ad-skip">Skip to content</a>
      <div className="ad-shell">
        <div className="ad-scrim" data-open={open} onClick={() => setOpen(false)} aria-hidden="true" />
        <aside className="ad-side" data-open={open} aria-label="Admin sidebar">
          <div className="ad-brand">
            <Image src="/logo.png" alt="" width={34} height={34} style={{ borderRadius: 8 }} />
            <div className="min-w-0 flex-1">Penny Pilot<small>Admin Console</small></div>
            <Button variant="ghost" size="sm" icon className="ad-hamburger" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} aria-hidden="true" /></Button>
          </div>
          <nav className="ad-nav" aria-label="Admin">
            {NAV.map((g) => (
              <div key={g.label} className="ad-nav-group">
                <div className="ad-nav-label">{g.label}</div>
                {g.items.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}>
                    <Icon size={18} aria-hidden="true" />{label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="ad-side-foot">
            <div className="px-2 pb-2">
              <div className="truncate font-semibold">{user?.name ?? "Administrator"}</div>
              <div className="ad-faint text-xs">{user?.role?.replace("_", " ")}</div>
            </div>
            <button type="button" className="ad-navlink ad-btn ghost" style={{ width: "100%", justifyContent: "flex-start" }} onClick={signOut} disabled={loggingOut}>
              <LogOut size={18} aria-hidden="true" />{loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </aside>

        <div className="ad-main">
          <header className="ad-top">
            <Button variant="ghost" icon className="ad-hamburger" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Menu size={20} aria-hidden="true" /></Button>
            <form onSubmit={search} role="search" className="relative min-w-0 flex-1" style={{ maxWidth: 420 }}>
              <label htmlFor="ad-search" className="ad-sr">Search users by name, email or UID</label>
              <Search size={16} className="ad-faint absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input id="ad-search" className="ad-input" style={{ paddingLeft: 36 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users, email or UID" />
            </form>
            <span className="flex-1" />
            <Button variant="ghost" icon onClick={refresh} aria-label="Refresh data" title="Refresh data"><RefreshCw size={18} className={fetching ? "animate-spin" : undefined} aria-hidden="true" /></Button>
            <Button variant="ghost" icon onClick={toggleTheme} aria-label="Toggle light or dark theme" title="Toggle theme">
              {effective() === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </Button>
          </header>
          <main id="ad-main" className="ad-content" tabIndex={-1}>{children}</main>
        </div>
      </div>

      <nav className="ad-bottom" aria-label="Quick navigation">
        {BOTTOM.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}><Icon size={20} aria-hidden="true" />{label}</Link>
        ))}
        <button type="button" onClick={() => setOpen(true)} aria-label="Open full menu"><Menu size={20} aria-hidden="true" />Menu</button>
      </nav>
    </div>
  );
}
