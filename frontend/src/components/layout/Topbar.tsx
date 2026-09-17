"use client";

import { Moon, Sun, RefreshCw, Menu, Bell, User, Settings, Palette, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useUiStore } from "@/store/uiStore";
import { useNotifications, useProfile } from "@/lib/reference";
import { useSettingsContext } from "@/lib/SettingsContext";
import { useAuth } from "@/lib/AuthContext";
import { playVoiceGreeting, VOICE_GREETINGS, isVoiceGreetingsEnabled } from "@/lib/voiceGreeting";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/format";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { QuickActions } from "./QuickActions";
import { DesktopSearch } from "./DesktopSearch";

export function Topbar({ title }: { title: string }) {
  const { toggleSidebar, unreadNotifications, setUnreadNotifications } = useUiStore();
  const { settings, updateSettings, resolvedTheme } = useSettingsContext();
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useProfile();
  const { data: notifData } = useNotifications();


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

  // Strict two-state toggle based on the theme actually applied right now
  // (resolvedTheme), not the raw saved preference — this is what keeps the
  // icon and the <html> class in sync even when the saved preference is
  // "system" and the OS is in dark mode.
  const toggleTheme = useCallback(() => {
    updateSettings({ theme: resolvedTheme === "dark" ? "light" : "dark" });
  }, [resolvedTheme, updateSettings]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    setAvatarOpen(false);
    // Speak before the session is torn down, since this is a real
    // user-initiated sign-out (a deliberate click on this menu item) — not
    // a session expiry or forced logout, which never reach this handler.
    const voiceEnabled = isVoiceGreetingsEnabled(settings.preferences);
    if (voiceEnabled) {
      playVoiceGreeting("signOut", { enabled: voiceEnabled });
      toast(VOICE_GREETINGS.signOut, "info");
    }
    await logout();
    // Give the goodbye clip a brief, bounded moment to actually fetch and
    // start playing before the hard navigation below unloads the page (and
    // any in-flight audio with it) — never blocks logout itself, and only
    // applies when a greeting was actually queued.
    if (voiceEnabled) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    // Hard navigation, not router.replace — a client-side route change
    // leaves the whole in-memory app (React Query cache, any component
    // state, other logic that assumed a signed-in user) alive underneath
    // the login screen. A full reload guarantees every last bit of that is
    // torn down and /login starts from a truly clean slate.
    window.location.href = "/login";
  }, [logout, settings.preferences, toast]);

  const displayName = profile?.name || "User";
  const displayEmail = profile?.email || "";
  const avatarSrc = profile?.avatar || null;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-indigo-100/60 bg-slate-50/80 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-navy-dark/80 sm:h-16 lg:px-6">
      <div className="flex items-center gap-2 min-w-0 sm:gap-3">
        <button
          onClick={toggleSidebar}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-navy hover:bg-black/5 active:scale-90 transition-transform dark:text-white dark:hover:bg-white/10 sm:h-9 sm:w-9 lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-semibold text-navy dark:text-white sm:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {user?.role === "USER" && <QuickActions />}
        <DesktopSearch />
        <Link
          href="/settings/storage"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black/5 text-navy active:scale-90 transition-transform hover:bg-black/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 sm:h-9 sm:w-9"
          aria-label="Sync"
        >
          <RefreshCw className="h-4 w-4" />
        </Link>

        <button
          onClick={toggleTheme}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-100 text-amber-600 shadow-inner transition-all duration-300 active:scale-90 hover:bg-amber-200/80 dark:border-transparent dark:bg-slate-800/50 dark:text-white dark:shadow-none dark:hover:bg-slate-700 sm:h-9 sm:w-9"
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
        >
          <motion.span
            key={resolvedTheme}
            className="flex"
            initial={{ rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </motion.span>
        </button>

        <Link
          href="/notifications"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-black/5 text-navy active:scale-90 transition-transform hover:bg-black/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 sm:h-9 sm:w-9"
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal/10 text-teal active:scale-90 transition-transform hover:bg-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 overflow-hidden sm:h-9 sm:w-9"
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
