"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type QuickAddType = "EXPENSE" | "INCOME" | null;

interface UiState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  unreadNotifications: number;
  collapsedNavGroups: Record<string, boolean>;
  quickAddType: QuickAddType;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setUnreadNotifications: (count: number) => void;
  toggleNavGroup: (group: string) => void;
  openQuickAdd: (type: QuickAddType) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,
      unreadNotifications: 0,
      collapsedNavGroups: {},
      quickAddType: null,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setUnreadNotifications: (count) => set({ unreadNotifications: count }),
      toggleNavGroup: (group) =>
        set({ collapsedNavGroups: { ...get().collapsedNavGroups, [group]: !get().collapsedNavGroups[group] } }),
      openQuickAdd: (type) => set({ quickAddType: type }),
    }),
    {
      name: "pfd-ui-store",
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, collapsedNavGroups: state.collapsedNavGroups }),
    }
  )
);
