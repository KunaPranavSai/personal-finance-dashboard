"use client";

import { createContext, useContext, useEffect, useCallback, useMemo, useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export interface AppSettingsData {
  theme: string;
  currency: string;
  dateFormat: string;
  weekStartsOn: string;
  timeFormat: string;
  language: string;
  timezone: string;
  firstDayOfWeek: string;
  applicationName: string;
  defaultDashboard: string;
  startupPreferences: string;
  currencySymbol: string;
  numberFormat: string;
  notifications: Record<string, unknown>;
  security: Record<string, unknown>;
  export: Record<string, unknown>;
  backup: Record<string, unknown>;
  privacy: Record<string, unknown>;
  preferences: Record<string, unknown>;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: AppSettingsData = {
  theme: "light",
  currency: "INR",
  dateFormat: "DD-MM-YYYY",
  weekStartsOn: "monday",
  timeFormat: "24h",
  language: "en",
  timezone: "Asia/Kolkata",
  firstDayOfWeek: "monday",
  applicationName: "Penny Pilot",
  defaultDashboard: "dashboard",
  startupPreferences: "last-viewed",
  currencySymbol: "INR",
  numberFormat: "1,234.56",
  notifications: {
    email: true, push: true, budgetAlerts: true, billReminders: true, goalUpdates: true, insights: true,
    reminderFrequency: "daily",
  },
  security: { twoFactorEnabled: false, sessionTimeout: 30, autoLock: 15, changePassword: false },
  export: { defaultFormat: "csv", includeAttachments: false },
  backup: { autoBackup: false, backupFrequency: "weekly" },
  privacy: { shareAnonymousData: true, showInSuggestions: false, analytics: true, crashReporting: true, tracking: true },
  preferences: { compactMode: false, showTips: true, confirmBeforeDelete: true, defaultTransactionType: "EXPENSE", defaultCharts: "income-expense", defaultFilters: "all" },
};

interface SettingsContextValue {
  settings: AppSettingsData;
  isLoading: boolean;
  updateSettings: (data: Record<string, unknown>) => void;
  isSaving: boolean;
  /** The theme actually applied to <html> right now — "dark" or "light",
   * with "system"/anything else already resolved against the OS preference.
   * Use this (not settings.theme) anywhere that needs to know if dark mode
   * is currently active, e.g. the theme toggle button's icon. */
  resolvedTheme: "light" | "dark";
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  updateSettings: () => {},
  isSaving: false,
  resolvedTheme: "light",
});

/** Single source of truth for "is dark mode active right now" — also written
 * to localStorage under THEME_STORAGE_KEY so the anti-flash inline script in
 * layout.tsx can read the exact same value on the next page load, instead of
 * the previous pfd-ui-store lookup which checked a field that store never
 * actually persisted (a real, dead field), silently defeating the anti-flash
 * script and causing the toggle to look out of sync after a refresh. */
export const THEME_STORAGE_KEY = "pfd-theme";

function resolveIsDark(theme: string): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: string): boolean {
  const isDark = resolveIsDark(theme);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", isDark);
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
  return isDark;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, unknown>>("/api/settings"),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const settings = useMemo<AppSettingsData>(
    () => (data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS),
    [data]
  );

  const [resolvedDark, setResolvedDark] = useState(() => resolveIsDark(settings.theme));

  useEffect(() => {
    setResolvedDark(applyTheme(settings.theme));
    // While the saved preference is "system" (or unset), keep watching the OS
    // preference live — otherwise the toggle icon and <html> class would only
    // update on the next settings change, not when the OS theme flips.
    if (settings.theme === "dark" || settings.theme === "light") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setResolvedDark(applyTheme(settings.theme));
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [settings.theme]);

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch("/api/settings", patch),
  });

  const updateSettings = useCallback(
    (patch: Record<string, unknown>) => {
      queryClient.setQueryData(["settings"], (old: Record<string, unknown> | undefined) => {
        const current = { ...DEFAULT_SETTINGS, ...old };
        const merged = { ...current };
        for (const [key, value] of Object.entries(patch)) {
          if (value !== null && typeof value === "object" && !Array.isArray(value) && typeof current[key] === "object" && current[key] !== null) {
            merged[key] = { ...(current[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
          } else {
            merged[key] = value;
          }
        }
        return merged;
      });
      mutation.mutate(patch);
    },
    [mutation, queryClient]
  );

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSettings, isSaving: mutation.isPending, resolvedTheme: resolvedDark ? "dark" : "light" }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  return useContext(SettingsContext);
}
