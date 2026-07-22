"use client";

import { Moon, Sun, Search, Menu, Bell, User, Settings, Palette, LogOut, Clock } from "lucide-react";
import { useUiStore } from "@/store/uiStore";
import { useNotifications, useProfile } from "@/lib/reference";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/format";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { QuickActions } from "./QuickActions";

function SessionCountdown() {
  const { sessionTimeoutMinutes, lastActivity } = useAuth();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!sessionTimeoutMinutes || sessionTimeoutMinutes <= 0) return null;

  const remainingMs = Math.max(0, sessionTimeoutMinutes * 60 * 1000 - (now - lastActivity));
  const totalSeconds = Math.floor(remainingMs / 1000);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  const isLow = totalSeconds <= 60;

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-1 rounded-lg px-1.5 text-[11px] font-medium tabular-nums sm:gap-1.5 sm:px-2.5 sm:text-xs",
        isLow ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-black/5 text-navy/50 dark:bg-white/5 dark:text-white/40"
      )}
      title="Time until session auto-logout"
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
    </div>
  );
}

export function Topbar({ title }: { title: string }) {
  const { toggleSidebar, unreadNotifications, setUnreadNotifications } = useUiStore();
  const { settings, updateSettings } = useSettingsContext();
  const { logout, user } = useAuth();
  const router = useRouter();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useProfile();
  const { data: notifData } = useNotifications();

  const theme = settings.theme;

  useEffect(() => {
    if (notifData?.items) {
      setUnreadNotifications(notifData.items.filter((n) => !n.read).length);
    }
  }, [notifData, setUnreadNotifications]);

  useEffect(() => {
    setImgError(false);
  }, [profile?.avatar]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setAvatarOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    updateSettings({ theme: next });
  }, [theme, updateSettings]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    setAvatarOpen(false);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }, [logout, router]);

  const displayName = profile?.name || "User";
  const displayEmail = profile?.email || "";
  const avatarSrc = profile?.avatar || null;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-black/5 bg-white/80 px-3 backdrop-blur dark:border-white/10 dark:bg-navy-dark/80 sm:h-16 lg:px-6">
      <div className="flex items-center gap-2 min-w-0 sm:gap-3">
        <button
          onClick={toggleSidebar}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-navy hover:bg-black/5 dark:text-white dark:hover:bg-white/10 lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-semibold text-navy dark:text-white sm:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {user?.role === "USER" && <QuickActions />}
        <div className="hidden sm:flex items-center gap-2 rounded-lg bg-black/5 px-3 py-1.5 text-sm text-navy/50 dark:bg-white/5 dark:text-white/40">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search transactions…"
            className="w-24 min-w-0 bg-transparent text-sm outline-none text-navy dark:text-white placeholder:text-navy/50 dark:placeholder:text-white/40 lg:w-36"
            aria-label="Search transactions"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = searchRef.current?.value || "";
                router.push(`/expenses?search=${encodeURIComponent(val)}`);
              }
            }}
          />
        </div>

        <SessionCountdown />

        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/5 text-navy hover:bg-black/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <Link
          href="/notifications"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/5 text-navy hover:bg-black/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </Link>

        <div ref={menuRef}>
          <button
            onClick={() => setAvatarOpen(!avatarOpen)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal hover:bg-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 overflow-hidden"
            aria-label="User menu"
            aria-expanded={avatarOpen}
            aria-haspopup="true"
          >
            {avatarSrc && !imgError ? (
              <Image src={avatarSrc} alt="" className="h-full w-full object-cover" width={36} height={36} unoptimized onError={() => setImgError(true)} />
            ) : (
              <User className="h-5 w-5" />
            )}
          </button>

          {avatarOpen && createPortal(
            <div
              className="fixed right-4 top-14 z-50 w-48 overflow-hidden rounded-xl border border-black/5 bg-white shadow-lg dark:border-white/10 dark:bg-navy-dark sm:top-16"
              ref={menuRef}
              role="menu"
              aria-label="User menu"
            >
              <div className="border-b border-black/5 px-4 py-3 dark:border-white/10">
                <p className="truncate text-sm font-medium text-navy dark:text-white">
                  {displayName}
                </p>
                <p className="truncate text-xs text-navy/50 dark:text-white/50">
                  {displayEmail}
                </p>
              </div>
              <div className="py-1">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:bg-black/5 dark:focus-visible:bg-white/5"
                  role="menuitem"
                  onClick={() => setAvatarOpen(false)}
                >
                  <User className="h-4 w-4" /> Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:bg-black/5 dark:focus-visible:bg-white/5"
                  role="menuitem"
                  onClick={() => setAvatarOpen(false)}
                >
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <Link
                  href="/settings?tab=appearance"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:bg-black/5 dark:focus-visible:bg-white/5"
                  role="menuitem"
                  onClick={() => setAvatarOpen(false)}
                >
                  <Palette className="h-4 w-4" /> Appearance
                </Link>
                <Link
                  href="/notifications"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-navy/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:bg-black/5 dark:focus-visible:bg-white/5"
                  role="menuitem"
                  onClick={() => setAvatarOpen(false)}
                >
                  <Bell className="h-4 w-4" /> Notifications
                </Link>
              </div>
              <div className="border-t border-black/5 py-1 dark:border-white/10">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 disabled:opacity-50"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </header>
  );
}
