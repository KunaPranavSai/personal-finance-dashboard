"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Messages shown wherever an administrator-disabled storage option is displayed. */
export const DRIVE_DISABLED_TEXT = "Disabled by Administrator";
export const DEVICE_DISABLED_TEXT = "This Feature will be enabled only on App";

/** Shared look for a disabled storage control: visible, dimmed, no hover affordance. */
export const DISABLED_STORAGE_STYLE = { opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" as const };

/**
 * The administrator's global storage policy (Admin -> System Settings -> Storage), read from the public settings
 * endpoint. The backend enforces the same policy on every Drive action; this only drives how the options are shown.
 * Until it loads, both options are treated as available so the screens do not flash a disabled state.
 */
export function useStoragePolicy() {
  const q = useQuery({
    queryKey: ["storage-policy"],
    queryFn: () => api.get<{ storage?: { drive: boolean; device: boolean } }>("/api/public/settings"),
    staleTime: 30_000,
  });
  return { drive: q.data?.storage?.drive ?? true, device: q.data?.storage?.device ?? true, loaded: !q.isLoading };
}
