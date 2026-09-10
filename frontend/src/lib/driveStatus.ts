"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, DRIVE_DISCONNECTED_EVENT } from "./api";

export interface DriveStatus {
  configured: boolean;
  connected: boolean;
  initialized: boolean;
  accountEmail: string | null;
}

export const DRIVE_STATUS_QUERY_KEY = ["drive-status"];

/** True once Drive is connected AND its workspace has actually been initialized — this is the
 * single source of truth the mandatory-onboarding gate and Settings both check against. */
export function isDriveReady(status: DriveStatus | undefined): boolean {
  return Boolean(status?.connected && status?.initialized);
}

export function useDriveStatus() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: DRIVE_STATUS_QUERY_KEY,
    queryFn: () => api.get<DriveStatus>("/api/drive/status"),
    staleTime: 15 * 1000,
  });

  useEffect(() => {
    const onDisconnected = () => queryClient.invalidateQueries({ queryKey: DRIVE_STATUS_QUERY_KEY });
    window.addEventListener(DRIVE_DISCONNECTED_EVENT, onDisconnected);
    return () => window.removeEventListener(DRIVE_DISCONNECTED_EVENT, onDisconnected);
  }, [queryClient]);

  return query;
}
