"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, UserCheck, ShieldCheck, ShieldAlert, History,
  User, X, ChevronDown, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";
import { useEffect, useCallback } from "react";

interface NavGroup {
  id: string;
  label: string | null;
  items: { href: string; label: string; icon: typeof LayoutDashboard }[];
}

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: null,
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "users",
    label: "User Management",
    items: [
      { href: "/admin/users", label: "All Users", icon: Users },
      { href: "/admin/pending", label: "Pending Approvals", icon: UserCheck },
      { href: "/admin/roles", label: "Roles & Permissions", icon: KeyRound },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      { href: "/admin/security", label: "Security Center", icon: ShieldAlert },
      { href: "/admin/activity", label: "Activity Logs", icon: History },
    ],
  },
  {
    id: "manage",
    label: "Manage",
    items: [{ href: "/settings", label: "Profile", icon: User }],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, collapsedNavGroups, toggleNavGroup } = useUiStore();

  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  const isItemActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  const sidebarContent = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 scrollbar-thin" aria-label="Admin navigation">
      {ADMIN_NAV_GROUPS.map((group) => {
        const groupActive = group.items.some((item) => isItemActive(item.href));
        const isCollapsed = Boolean(collapsedNavGroups[`admin-${group.id}`]) && !groupActive;

        return (
          <div key={group.id} className="mb-1">
            {group.label && (
              <button
                type="button"
                onClick={() => toggleNavGroup(`admin-${group.id}`)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-navy/40 hover:text-navy/60 dark:text-white/30 dark:hover:text-white/50"
                aria-expanded={!isCollapsed}
              >
                <span>{group.label}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isCollapsed && "-rotate-90")} />
              </button>
            )}
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
