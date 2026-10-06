"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Wallet, PiggyBank, Target,
  Receipt, TrendingUp, TrendingDown, BarChart3, FileText, Bell, User, X, Landmark,
  SlidersHorizontal, ChevronDown, PanelLeftClose, PanelLeftOpen, Shield, Palette, Eye, Database,
} from "lucide-react";
import { cn } from "@/lib/format";
import { useUiStore } from "@/store/uiStore";
import { useEffect, useCallback, useState, Suspense } from "react";

interface NavGroup {
  id: string;
  label: string | null;
  items: { href: string; label: string; icon: typeof LayoutDashboard }[];
}

// Same five destinations as the approved mobile bottom nav (Home / Activity /
// Budget / Invest / More) surfaced first and unlabeled, exactly like the
// mobile tab bar has no section headers — everything else follows as
// secondary groups. No destination is duplicated between groups.
const NAV_GROUPS: NavGroup[] = [
  {
    id: "primary",
    label: null,
    items: [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard },
      { href: "/transactions", label: "Activity", icon: Receipt },
      { href: "/capital", label: "Capital", icon: Wallet },
      { href: "/analytics", label: "Analysis", icon: BarChart3 },
    ],
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
    id: "planning",
    label: "Planning",
    items: [
      { href: "/budget", label: "Budgets", icon: Wallet },
      { href: "/investments", label: "Investments", icon: Landmark },
      { href: "/bills", label: "Bills & EMI", icon: FileText },
      { href: "/savings", label: "Savings", icon: PiggyBank },
      { href: "/goals", label: "Financial Goals", icon: Target },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    items: [
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    id: "manage",
    label: "Manage",
    items: [
      { href: "/customizations", label: "Customizations", icon: SlidersHorizontal },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/profile", label: "Profile", icon: User },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { href: "/settings?tab=preferences", label: "Preferences", icon: Palette },
      { href: "/settings?tab=security", label: "Security", icon: Shield },
      { href: "/settings?tab=privacy", label: "Privacy & Activity", icon: Eye },
      { href: "/settings?tab=data", label: "Data & Storage", icon: Database },
      { href: "/settings?tab=account", label: "Account", icon: User },
    ],
  },
];

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, collapsedNavGroups, toggleNavGroup } = useUiStore();

  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  const isItemActive = (href: string) => {
    const [path, query] = href.split("?");
    if (pathname !== path && !pathname?.startsWith(path + "/")) return false;
    if (!query) return true;
    const wantedTab = new URLSearchParams(query).get("tab");
    if (!wantedTab) return true;
    // /settings with no ?tab defaults to "appearance" server-side, so treat that as its match too.
    return (searchParams.get("tab") ?? "appearance") === wantedTab;
  };

  const [hoverExpanded, setHoverExpanded] = useState(false);
  const showLabels = !sidebarCollapsed || hoverExpanded;

  const sidebarContent = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 scrollbar-thin" aria-label="Main navigation">
      {NAV_GROUPS.map((group, i) => {
        const groupActive = group.items.some((item) => isItemActive(item.href));
        const isCollapsed = Boolean(collapsedNavGroups[group.id]) && !groupActive;

        return (
          <div
            key={group.id}
            className={cn(
              "mb-1 pb-2",
              i < NAV_GROUPS.length - 1 && "border-b border-pp-border"
            )}
          >
            {group.label && showLabels && (
              <button
                type="button"
                onClick={() => toggleNavGroup(group.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-pp-text-dim hover:text-pp-text"
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
                      title={showLabels ? undefined : label}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/50",
                        !showLabels && "justify-center px-0",
                        active
                          ? "bg-pp-accent/10 text-pp-accent"
                          : "text-pp-text-dim hover:bg-pp-surface-2"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {showLabels && <span className="truncate">{label}</span>}
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
      className="flex h-8 w-8 items-center justify-center rounded-lg text-pp-text-dim hover:bg-pp-surface-2 lg:hidden"
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

      <motion.aside
        animate={{ width: sidebarCollapsed ? 80 : 256 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        onMouseEnter={() => sidebarCollapsed && setHoverExpanded(true)}
        onMouseLeave={() => setHoverExpanded(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden border-r border-pp-border bg-pp-surface px-3 py-5 shadow-pp transition-all duration-300 ease-in-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className={cn("mb-6 flex items-center px-1", showLabels ? "justify-between" : "flex-col gap-2")}>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2" onClick={closeSidebar}>
            <Image src="/logo.png" alt="Penny Pilot" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            {showLabels && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight text-pp-text">Penny Pilot</p>
              </div>
            )}
          </Link>
          {/* Desktop collapse/expand toggle — moved here from the sidebar
              footer so it's immediately visible next to the logo in both
              states, instead of requiring a scroll to the bottom. */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-pp-text-dim transition-colors hover:bg-pp-surface-2 lg:flex"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          {sidebarToggle}
        </div>

        {sidebarContent}
      </motion.aside>
    </>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={<aside className="hidden w-64 shrink-0 border-r border-pp-border bg-pp-surface lg:block" />}>
      <SidebarInner />
    </Suspense>
  );
}
