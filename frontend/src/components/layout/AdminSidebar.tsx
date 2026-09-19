"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, HardDrive, Activity, Settings as SettingsIcon,
  User, ShieldCheck, LogOut, X, ChevronDown, Megaphone, Mail, Plug, Zap, Send,
} from "lucide-react";
import { cn } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useCallback, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Only sections that map to a real, working admin page — no placeholder links. A few labels the
// spec asks for (Sessions as a standalone page, Notifications as an admin-managed resource,
// Backups as its own page) don't have a genuinely separate page yet — per-user Sessions live on
// each account's User 360 tab, Notifications are user-owned records with no admin CRUD surface,
// and the account-backup download lives on Application Settings — so they're intentionally
// omitted here rather than added as dead links.
const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    id: "command",
    label: "Command",
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }],
  },
  {
    id: "people",
    label: "People",
    items: [{ href: "/admin/users", label: "Users", icon: Users }],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/admin/system-health", label: "System Health", icon: Activity },
      { href: "/admin/migration", label: "Migration Status", icon: HardDrive },
      { href: "/admin/activity", label: "Audit / Activity Logs", icon: ShieldCheck },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    items: [
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/email-templates", label: "Email Templates", icon: Mail },
      { href: "/admin/automated-emails", label: "Automated Emails", icon: Zap },
      { href: "/admin/email", label: "Send Email", icon: Send },
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    items: [
      { href: "/admin/settings", label: "Application Settings", icon: SettingsIcon },
      { href: "/admin/integrations", label: "Integrations", icon: Plug },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, collapsedNavGroups, toggleNavGroup } = useUiStore();
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    closeSidebar();
    await logout();
    // Hard navigation — tears down the whole in-memory app rather than leaving stale
    // React Query cache / component state alive underneath the login screen.
    window.location.href = "/admin-login";
  }, [logout, closeSidebar]);

  const isItemActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  const navLinkClass = (active: boolean) =>
    cn(
      "cc-mono flex items-center gap-3 rounded px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/50",
      active ? "bg-[var(--cc-accent-dim)]" : "hover:bg-white/[0.04]"
    );
  const navLinkStyle = (active: boolean) => ({ color: active ? "var(--cc-accent)" : "var(--cc-text-dim)" });

  const sidebarContent = (
    <nav className="cc-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto px-2" aria-label="Admin navigation">
      {ADMIN_NAV_GROUPS.map((group) => {
        const groupActive = group.items.some((item) => isItemActive(item.href));
        const isCollapsed = Boolean(collapsedNavGroups[`admin-${group.id}`]) && !groupActive;

        return (
          <div key={group.id} className="mb-1">
            <button
              type="button"
              onClick={() => toggleNavGroup(`admin-${group.id}`)}
              className="cc-mono flex w-full items-center justify-between rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--cc-text-faint)" }}
              aria-expanded={!isCollapsed}
            >
              <span>{group.label}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isCollapsed && "-rotate-90")} />
            </button>
            {!isCollapsed && (
              <div className="flex flex-col gap-1">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isItemActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={closeSidebar}
                      className={navLinkClass(active)}
                      style={navLinkStyle(active)}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className={cn("cc-status-dot", active ? "online" : "")} style={!active ? { background: "var(--cc-text-faint)" } : undefined} />
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="mb-1 mt-auto">
        <button
          type="button"
          onClick={() => toggleNavGroup("admin-account")}
          className="cc-mono flex w-full items-center justify-between rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--cc-text-faint)" }}
          aria-expanded={!collapsedNavGroups["admin-account"]}
        >
          <span>Account</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", collapsedNavGroups["admin-account"] && "-rotate-90")} />
        </button>
        {!collapsedNavGroups["admin-account"] && (
          <div className="flex flex-col gap-1">
            <Link
              href="/admin/account"
              onClick={closeSidebar}
              className={navLinkClass(pathname === "/admin/account")}
              style={navLinkStyle(pathname === "/admin/account")}
            >
              <User className="h-4 w-4 shrink-0" /> Account Settings
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="cc-mono flex w-full items-center gap-3 rounded px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-[var(--cc-red)]/10 disabled:opacity-50"
              style={{ color: "var(--cc-red)" }}
            >
              <LogOut className="h-4 w-4 shrink-0" /> {loggingOut ? "Signing out…" : "Logout"}
            </button>
          </div>
        )}
      </div>
    </nav>
  );

  const sidebarToggle = (
    <button
      onClick={closeSidebar}
      className="flex h-8 w-8 items-center justify-center rounded lg:hidden"
      style={{ color: "var(--cc-text-dim)" }}
      aria-label="Close sidebar"
    >
      <X className="h-4 w-4" />
    </button>
  );

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "cc-scrollbar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r px-3 py-5 shadow-xl transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:block lg:translate-x-0 lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ borderColor: "var(--cc-border)", background: "var(--cc-bg-alt)" }}
        role="navigation"
        aria-label="Admin navigation"
      >
        <div className="mb-6 flex items-center justify-between px-3">
          <Link href="/admin" className="flex items-center gap-2" onClick={closeSidebar}>
            <Image src="/logo.png" alt="Penny Pilot" width={32} height={32} className="h-8 w-8 shrink-0 rounded object-cover" />
            <div className="min-w-0">
              <p className="cc-mono truncate text-[11px] font-bold uppercase leading-tight tracking-wider" style={{ color: "var(--cc-text)" }}>
                Penny Pilot
              </p>
              <p className="cc-mono flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cc-accent)" }}>
                <ShieldCheck className="h-3 w-3" /> Command Center
              </p>
            </div>
          </Link>
          {sidebarToggle}
        </div>

        {sidebarContent}
      </aside>
    </>
  );
}
