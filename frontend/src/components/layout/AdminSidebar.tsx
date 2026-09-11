"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, HardDrive, Activity, Settings as SettingsIcon,
  User, ShieldCheck, LogOut, X, ChevronDown,
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

// Only sections that map to a real, working admin page — no placeholder links. Structured
// around platform operations (users, Drive migration, system health, audit) rather than the
// old Postgres-financial-data-era admin surface.
const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "users",
    label: "Users",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/migration", label: "Migration Status", icon: HardDrive },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/admin/system-health", label: "System Health", icon: Activity },
      { href: "/admin/activity", label: "Activity / Audit Logs", icon: ShieldCheck },
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    items: [{ href: "/admin/settings", label: "Application Settings", icon: SettingsIcon }],
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

  const sidebarContent = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 scrollbar-thin" aria-label="Admin navigation">
      {ADMIN_NAV_GROUPS.map((group) => {
        const groupActive = group.items.some((item) => isItemActive(item.href));
        const isCollapsed = Boolean(collapsedNavGroups[`admin-${group.id}`]) && !groupActive;

        return (
          <div key={group.id} className="mb-1">
            <button
              type="button"
              onClick={() => toggleNavGroup(`admin-${group.id}`)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy/40 hover:text-navy/60 dark:text-white/30 dark:hover:text-white/50"
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
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50",
                        active
                          ? "bg-teal/10 text-teal"
                          : "text-navy/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/5"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
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
          className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy/40 hover:text-navy/60 dark:text-white/30 dark:hover:text-white/50"
          aria-expanded={!collapsedNavGroups["admin-account"]}
        >
          <span>Account</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", collapsedNavGroups["admin-account"] && "-rotate-90")} />
        </button>
        {!collapsedNavGroups["admin-account"] && (
          <div className="flex flex-col gap-1">
            <Link
              href="/settings"
              onClick={closeSidebar}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50",
                pathname === "/settings" ? "bg-teal/10 text-teal" : "text-navy/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/5"
              )}
            >
              <User className="h-4 w-4 shrink-0" /> Account Settings
            </Link>
            <Link
              href="/settings?tab=security"
              onClick={closeSidebar}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50",
                pathname === "/settings" ? "bg-teal/10 text-teal" : "text-navy/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/5"
              )}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" /> Security / 2FA
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
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
      className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/5 lg:hidden"
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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-black/5 bg-white px-3 py-5 shadow-xl transition-transform duration-300 ease-in-out dark:border-white/10 dark:bg-navy-dark lg:static lg:z-auto lg:block lg:translate-x-0 lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label="Admin navigation"
      >
        <div className="mb-6 flex items-center justify-between px-3">
          <Link href="/admin" className="flex items-center gap-2" onClick={closeSidebar}>
            <Image src="/logo.png" alt="Penny Pilot" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-navy dark:text-white">Penny Pilot</p>
              <p className="flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wider text-teal">
                <ShieldCheck className="h-3 w-3" /> Admin
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
