"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ArrowLeftRight, Wallet, PiggyBank, Target,
  Receipt, TrendingUp, BarChart3, FileText, Bell, Settings, User, X, Landmark,
} from "lucide-react";
import { cn } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";
import { useEffect, useCallback } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budget", label: "Budget Planner", icon: Wallet },
  { href: "/savings", label: "Savings", icon: PiggyBank },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/bills", label: "Bills & EMI", icon: Receipt },
  { href: "/goals", label: "Financial Goals", icon: Target },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/profile", label: "Profile", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed } = useUiStore();

  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  const sidebarContent = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 scrollbar-thin" aria-label="Main navigation">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(href + "/");
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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal text-sm font-bold text-white">
              ₹
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-navy dark:text-white">Finance Dashboard</p>
              <p className="text-[11px] leading-tight text-navy/40 dark:text-white/40">Pro</p>
            </div>
          </Link>
          {sidebarToggle}
        </div>

        {sidebarContent}
      </aside>
    </>
  );
}
