"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Wallet, PiggyBank, Target,
  Receipt, TrendingUp, TrendingDown, BarChart3, FileText, Bell, User, X, Landmark,
  SlidersHorizontal, ChevronDown, Shield, Palette, Eye, Database,
} from "lucide-react";
import { cn } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";
import { useEffect, useCallback } from "react";

interface NavGroup {
  id: string;
  label: string | null;
  items: { href: string; label: string; icon: typeof LayoutDashboard }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { href: "/expenses", label: "Expenses", icon: TrendingDown },
      { href: "/income", label: "Income", icon: TrendingUp },
    ],
  },
  {
    id: "budgets",
    label: "Budgets",
    items: [
      { href: "/budget", label: "Budget Planner", icon: Wallet },
      { href: "/bills", label: "Bills & EMI", icon: Receipt },
    ],
  },
  {
    id: "investments",
    label: "Investments",
    items: [
      { href: "/investments", label: "Investments", icon: Landmark },
      { href: "/savings", label: "Savings", icon: PiggyBank },
      { href: "/goals", label: "Financial Goals", icon: Target },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    id: "manage",
    label: null,
    items: [
      { href: "/customizations", label: "Customizations", icon: SlidersHorizontal },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/settings?tab=security", label: "Security", icon: Shield },
      { href: "/settings?tab=appearance", label: "Appearance", icon: Palette },
      { href: "/settings?tab=privacy", label: "Privacy", icon: Eye },
      { href: "/settings?tab=backup", label: "Backup & Export", icon: Database },
      { href: "/profile", label: "Profile", icon: User },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, collapsedNavGroups, toggleNavGroup } = useUiStore();

  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  const isItemActive = (href: string) => {
    const path = href.split("?")[0];
    return pathname === path || Boolean(pathname?.startsWith(path + "/"));
  };

  const sidebarContent = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 scrollbar-thin" aria-label="Main navigation">
      {NAV_GROUPS.map((group) => {
        const groupActive = group.items.some((item) => isItemActive(item.href));
        const isCollapsed = Boolean(collapsedNavGroups[group.id]) && !groupActive;

        return (
          <div key={group.id} className="mb-1">
            {group.label && (
              <button
                type="button"
                onClick={() => toggleNavGroup(group.id)}
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
        aria-label="Main navigation"
      >
        <div className="mb-6 flex items-center justify-between px-3">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={closeSidebar}>
            <Image src="/logo.png" alt="Penny Pilot" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-navy dark:text-white">Penny Pilot</p>
            </div>
          </Link>
          {sidebarToggle}
        </div>

        {sidebarContent}
      </aside>
    </>
  );
}
