"use client";

// User-facing top bar — visually retheme of the shared Topbar.tsx (which
// stays untouched because the Admin/Super Admin panel imports it directly
// per-page for its own header). Same behavior/props, approved Penny Pilot
// palette instead of the legacy navy/teal/indigo "Midnight Cockpit" look.
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
import { DriveSyncStatus } from "./DriveSyncStatus";
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

  const toggleTheme = useCallback(() => {
    updateSettings({ theme: resolvedTheme === "dark" ? "light" : "dark" });
  }, [resolvedTheme, updateSettings]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    setAvatarOpen(false);
    const voiceEnabled = isVoiceGreetingsEnabled(settings.preferences);
    if (voiceEnabled) {
      playVoiceGreeting("signOut", { enabled: voiceEnabled });
      toast(VOICE_GREETINGS.signOut, "info");
    }
    await logout();
    if (voiceEnabled) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    window.location.href = "/login";
  }, [logout, settings.preferences, toast]);

  const displayName = profile?.name || "User";
  const displayEmail = profile?.email || "";
  const avatarSrc = profile?.avatar || null;

  return (
    <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center justify-between border-b border-pp-border bg-pp-surface/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:min-h-16 lg:px-6">
      <div className="flex items-center gap-2 min-w-0 sm:gap-3">
        <button
          onClick={toggleSidebar}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-pp-text hover:bg-pp-surface-2 active:scale-90 transition-transform sm:h-9 sm:w-9 lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-semibold text-pp-text sm:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {user?.role === "USER" && <DriveSyncStatus />}
        {user?.role === "USER" && <QuickActions />}
        <DesktopSearch />
        <Link
          href="/settings/storage"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pp-surface-2 text-pp-text active:scale-90 transition-transform hover:opacity-80 sm:h-9 sm:w-9"
          aria-label="Sync"
        >
          <RefreshCw className="h-4 w-4" />
        </Link>

        <button
          onClick={toggleTheme}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-turmeric/15 text-turmeric transition-all duration-300 active:scale-90 hover:bg-turmeric/25 sm:h-9 sm:w-9"
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
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pp-surface-2 text-pp-text active:scale-90 transition-transform hover:opacity-80 sm:h-9 sm:w-9"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-vulcanico px-1 text-[10px] font-bold text-white">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </Link>

        <div ref={menuRef}>
          <button
            onClick={() => setAvatarOpen(!avatarOpen)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pp-accent text-pp-accent-ink active:scale-90 transition-transform hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent/50 overflow-hidden sm:h-9 sm:w-9"
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
              className="fixed right-4 top-14 z-50 w-48 overflow-hidden rounded-pp border border-pp-border bg-pp-surface shadow-pp sm:top-16"
              ref={menuRef}
              role="menu"
              aria-label="User menu"
            >
              <div className="border-b border-pp-border px-4 py-3">
                <p className="truncate text-sm font-medium text-pp-text">
                  {displayName}
                </p>
                <p className="truncate text-xs text-pp-text-dim">
                  {displayEmail}
                </p>
              </div>
              <div className="py-1">
                <Link
                  href="/profile"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm text-pp-text-dim hover:bg-pp-surface-2",
                    "focus-visible:outline-none focus-visible:bg-pp-surface-2"
                  )}
                  role="menuitem"
                  onClick={() => setAvatarOpen(false)}
                >
                  <User className="h-4 w-4" /> Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-pp-text-dim hover:bg-pp-surface-2 focus-visible:outline-none focus-visible:bg-pp-surface-2"
                  role="menuitem"
                  onClick={() => setAvatarOpen(false)}
                >
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <Link
                  href="/settings?tab=preferences"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-pp-text-dim hover:bg-pp-surface-2 focus-visible:outline-none focus-visible:bg-pp-surface-2"
                  role="menuitem"
                  onClick={() => setAvatarOpen(false)}
                >
                  <Palette className="h-4 w-4" /> Appearance
                </Link>
                <Link
                  href="/notifications"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-pp-text-dim hover:bg-pp-surface-2 focus-visible:outline-none focus-visible:bg-pp-surface-2"
                  role="menuitem"
                  onClick={() => setAvatarOpen(false)}
                >
                  <Bell className="h-4 w-4" /> Notifications
                </Link>
              </div>
              <div className="border-t border-pp-border py-1">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-vulcanico hover:bg-vulcanico/10 disabled:opacity-50"
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
