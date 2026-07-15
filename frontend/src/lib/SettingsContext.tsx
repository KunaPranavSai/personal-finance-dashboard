"use client";

import { createContext, useContext, useEffect, useCallback, useMemo, ReactNode } from "react";
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
  applicationName: "Finance Dashboard Pro",
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
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  updateSettings: () => {},
  isSaving: false,
});

function applyTheme(theme: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    root.classList.toggle("dark", mq.matches);
  }
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

  useEffect(() => {
    applyTheme(settings.theme);
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
    <SettingsContext.Provider value={{ settings, isLoading, updateSettings, isSaving: mutation.isPending }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  return useContext(SettingsContext);
}
