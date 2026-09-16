"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileStorageView } from "@/components/mobile/MobileStorageView";

/**
 * Real route for mobile Google Drive / Local-Only storage management.
 * Desktop has no separate route for this — it's the "Data & Storage" tab
 * within /settings — so desktop UAs are redirected there, preserving the
 * exact existing desktop tab UX (DataStorageCard/GoogleDriveBackupCard)
 * untouched. Mobile UAs get the native screen directly, no redirect.
 */
export default function StorageSettingsPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
    router.replace("/settings?tab=backup");
  }, [router, isMobile]);

  if (isMobile) return <MobileStorageView />;
  return null;
}
