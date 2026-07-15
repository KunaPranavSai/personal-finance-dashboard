"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  unreadNotifications: number;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setUnreadNotifications: (count: number) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,
      unreadNotifications: 0,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setUnreadNotifications: (count) => set({ unreadNotifications: count }),
    }),
    {
      name: "pfd-ui-store",
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
);
